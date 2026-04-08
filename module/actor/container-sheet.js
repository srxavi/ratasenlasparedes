import { ratasenlasparedesActorSheet } from "./actor-sheet.js";
import { ItemTypeSelection } from "../item/item-sheet.js";

export class ratasenlasparedesContainerSheet extends ratasenlasparedesActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ratasenlasparedes", "sheet", "actor", "container"],
      template: "systems/ratasenlasparedes/templates/actor/container-sheet.html",
      width: 520,
      height: 730,
    });
  }

  /** @override */
  async getData() {
    // Obtenemos el contexto base directamente de ActorSheet para asegurar compatibilidad
    const context = await ActorSheet.prototype.getData.call(this);
    
    context.system = this.actor.system;
    context.dtypes = ["String", "Number", "Boolean"];
    context.isGM = game.user.isGM;
    
    // Preparamos los items organizados por categorías
    this._prepareContainerItems(context);
    
    return context;
  }

  _prepareContainerItems(sheetData) {
    // Pasamos todos los items a una sola lista para la pestaña "Contenido"
    sheetData.allItems = sheetData.items;
  }

  /** @override */
  async _onItemCreate(event) {
    event.preventDefault();
    if (!game.user.isGM) return;
    const header = event.currentTarget.closest('.tab');
    const tabName = header?.dataset.tab;

    // Definimos qué tipos se pueden crear en cada pestaña
    const allowedTypes = {
      content: ['item', 'weapon', 'armor', 'spell']
    };

    // Si no hay pestaña específica, por defecto 'item'
    const types = allowedTypes[tabName] || ['item', 'weapon', 'armor', 'spell'];
    
    let itemData;
    // Solo mostramos el diálogo si hay más de un tipo posible
    if (types.length > 1) {
      itemData = await ItemTypeSelection.create(this.actor, types);
    } else {
      // Si solo hay uno, lo creamos directamente con el nombre base "Objeto"
      // para que el hook preCreateItem gestione la traducción automática del nombre.
      itemData = {
        name: "Objeto",
        type: types[0]
      };
    }

    if (!itemData) return;

    return await this.actor.createEmbeddedDocuments("Item", [itemData]);
  }

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);
    
    // Forzamos la asignación del evento dragstart para asegurar que funciona siempre
    html.find('.item').each((i, li) => {
        if (li.classList.contains("item-header")) return;
        li.setAttribute("draggable", true);
        li.addEventListener("dragstart", this._onDragStart.bind(this), false);
    });

    // Botón para recoger objeto
    html.find('.item-take').click(this._onItemTake.bind(this));
  }

  /** @override */
  _onDragStart(event) {
      const li = event.currentTarget;
      if ( event.target.classList.contains("content-link") ) return;

      // Crear datos de arrastre
      const item = this.actor.items.get(li.dataset.itemId);
      if (!item) return;
      
      // Obtenemos los datos crudos y preparamos los flags
      const itemData = item.toObject();
      
      // Limpieza profunda de datos para asegurar que se crea como nuevo
      delete itemData._id;
      delete itemData.sort;
      delete itemData.folder;
      delete itemData.ownership;
      
      itemData.flags = itemData.flags || {};
      itemData.flags.ratasenlasparedes = { sourceContainerId: this.actor.uuid, sourceItemId: item.id };

      // Construimos el dragData SOLO con data (sin uuid) para forzar el uso de nuestros flags
      const dragData = {
          type: "Item",
          data: itemData
      };

      event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
  }

  /** @override */
  async _onDrop(event) {
    if (!game.user.isGM) return false;

    const data = TextEditor.getDragEventData(event);
    if (data.type === "Item" && data.uuid) {
      const sourceItem = await fromUuid(data.uuid);
      // Restricción: No permitir pasar Estigmas de Character a Container
      if (sourceItem && sourceItem.actor && sourceItem.actor.type === "character" && sourceItem.type === "stigma") {
        ui.notifications.warn("No puedes guardar Estigmas en un Contenedor.");
        return false;
      }
    }

    return super._onDrop(event);
  }

  /**
   * Gestiona el click en el botón de recoger
   */
  async _onItemTake(event) {
    event.preventDefault();
    const li = event.currentTarget.closest(".item");
    const itemId = li.dataset.itemId;
    const item = this.actor.items.get(itemId);

    // Buscar personajes que pertenezcan al usuario
    const targets = game.actors.filter(a => a.type === "character" && a.isOwner);

    if (targets.length === 0) {
        return ui.notifications.warn("No tienes ningún personaje disponible para recibir este objeto.");
    }

    if (targets.length === 1) {
        return this._transferItem(item, targets[0]);
    }

    // Si hay más de uno, mostrar diálogo
    let content = `
    <form>
        <div class="form-group">
            <label>Selecciona el personaje:</label>
            <select name="targetActor" style="width: 100%; margin-top: 5px;">`;
    for (let actor of targets) {
        content += `<option value="${actor.id}">${actor.name}</option>`;
    }
    content += `</select></div></form>`;

    new Dialog({
        title: "Recoger Objeto",
        content: content,
        buttons: {
            take: {
                icon: '<i class="fas fa-hand-paper"></i>',
                label: "Recoger",
                callback: (html) => {
                    const actorId = html.find('[name="targetActor"]').val();
                    const target = game.actors.get(actorId);
                    if (target) this._transferItem(item, target);
                }
            }
        },
        default: "take",
        render: (html) => {
            const header = html.closest('.window-app').find('.window-header');
            header.css('color', '#ffffff');
            header.find('.window-title').css('color', '#ffffff');
            header.find('.close').css('color', '#ffffff');
        }
    }, {
        classes: ["ratasenlasparedes", "difficulty-dialog", "dialog"]
    }).render(true);
  }

  async _transferItem(item, targetActor) {
      const itemData = item.toObject();
      // Limpiamos datos para crear una copia limpia
      delete itemData._id;
      delete itemData.sort;
      delete itemData.folder;
      delete itemData.ownership;
      
      // Crear en destino
      await targetActor.createEmbeddedDocuments("Item", [itemData]);
      
      // Borrar de origen (Contenedor)
      await this.actor.deleteEmbeddedDocuments("Item", [item.id]);
      
      ui.notifications.info(`${item.name} recogido por ${targetActor.name}.`);
  }
}

// Hooks para gestionar el saqueo de contenedores
Hooks.on("preCreateItem", (item, data, options, userId) => {
    const flags = data.flags?.ratasenlasparedes;
    // Si el objeto viene de un contenedor (marcado en _onDragStart)
    if (flags?.sourceContainerId && flags?.sourceItemId) {
        // Pasamos la info a las opciones para usarla en createItem
        options.sourceContainerId = flags.sourceContainerId;
        options.sourceItemId = flags.sourceItemId;
        
        // Limpiamos los flags del nuevo objeto para que no se guarden
        const newFlags = foundry.utils.deepClone(item._source.flags.ratasenlasparedes || {});
        delete newFlags.sourceContainerId;
        delete newFlags.sourceItemId;
        item.updateSource({"flags.ratasenlasparedes": newFlags});
    }
});

Hooks.on("createItem", async (item, options, userId) => {
    if (userId !== game.user.id) return;
    // Si viene de un contenedor, borramos el original
    if (options.sourceContainerId && options.sourceItemId) {
        const sourceActor = await fromUuid(options.sourceContainerId);
        if (sourceActor && sourceActor.type === 'container') {
            await sourceActor.deleteEmbeddedDocuments("Item", [options.sourceItemId]);
        }
    }
});