import { ItemTypeSelection } from "../item/item-sheet.js";

/**
 * Extend the basic ActorSheet with some very simple modifications
 * @extends {ActorSheet}
 */
export class ratasenlasparedesNpcSheet extends ActorSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ratasenlasparedes", "sheet", "actor", "npc"],
      //template: "systems/ratasenlasparedes/templates/actor/npc-sheet.html",
      width: 520,
      height: 730,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  get template() {
        // Later you might want to return a different template
        // based on user permissions.
        if (!game.user.isGM && this.actor.limited)
            return 'systems/ratasenlasparedes/templates/actor/limited-sheet.html';
        return 'systems/ratasenlasparedes/templates/actor/npc-sheet.html';
    }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    const context = await super.getData();
    
    // Add actor to context
    context.actor = this.actor;
    context.dtypes = ["String", "Number", "Boolean"];

    // Set default image if none exists
    context.img = this.actor.img || "icons/svg/mystery-man.svg";

    // Prepare items.
    if (this.actor.type == 'npc') {
      this._prepareCharacterItems(context);
    }

    // Get the data from actor.system
    const system = this.actor.system;

    // Initialize system data if needed
    if (!system.pv) system.pv = { value: 0, max: 0 };
    if (!system.pc) system.pc = { value: 0, max: 0 };

    // Make sure we have valid numbers
    system.pv.value = Number.isNaN(Number(system.pv.value)) ? 0 : Number(system.pv.value);
    system.pv.max = Number.isNaN(Number(system.pv.max)) ? 0 : Number(system.pv.max);
    system.pc.value = Number.isNaN(Number(system.pc.value)) ? 0 : Number(system.pc.value);
    system.pc.max = Number.isNaN(Number(system.pc.max)) ? 0 : Number(system.pc.max);

    // Add to context
    context.system = system;

    // Enrich the biography text
    context.enrichedBio = await TextEditor.enrichHTML(this.object.system.biography || "", {
      secrets: this.object.isOwner,
      relativeTo: this.object
    });

    return context;
  }
  



  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add Inventory Item
    html.find('.item-create').click(ev => this._onItemCreate(ev));
    
    // Update Inventory Item
    html.find('.item-edit').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      const item = this.actor.getEmbeddedDocument("Item",li.data("itemId"));
      item.sheet.render(true);
    });

    // Delete Inventory Item
    html.find('.item-delete').click(ev => {
      const li = $(ev.currentTarget).parents(".item");
      if (li.length > 0) {
        this.actor.deleteEmbeddedDocuments("Item",[li.data("itemId")]);
        li.slideUp(200, () => this.render(false));
      } else {
        const itemId = $(ev.currentTarget).data("item-id");
        this.actor.deleteEmbeddedDocuments("Item", [itemId]);
      }
    });

    // Clickable item links
    html.find('.item-link').click(ev => {
      const itemId = $(ev.currentTarget).data("item-id");
      const item = this.actor.getEmbeddedDocument("Item", itemId);
      item.sheet.render(true);
    });

    // Create specific items (Profesion/Reputation)
    html.find('.item-create-specific').click(async (ev) => {
      const type = ev.currentTarget.dataset.type;
      if (!type) return;

      const itemData = {
        name: `Nueva ${type.charAt(0).toUpperCase() + type.slice(1)}`,
        type: type,
        system: {}
      };

      await this.actor.createEmbeddedDocuments("Item", [itemData]);
    });

    // Rollable abilities.
    html.find('.rollable').click(this._onRoll.bind(this));
    // PC roll dialog
    html.find('.ratas-pc-roll').click(this._onPcRoll.bind(this));

    // Habilitar arrastre de objetos (Drag & Drop)
    html.find('.item').each((i, li) => {
      if (li.classList.contains("item-header")) return;
      li.setAttribute("draggable", true);
      li.addEventListener("dragstart", this._onDragStart.bind(this), false);
    });
  }

  async _onPcRoll(event) {
    event.preventDefault();
    const templateData = { };
    const content = await renderTemplate('systems/ratasenlasparedes/templates/dialogs/pc-roll-dialog.html', templateData);

    const dialog = new Dialog({
      title: 'Lanzar PC',
      content,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d6"></i>',
          label: 'Tirar',
          callback: async (dlg) => {
            const numDice = parseInt(dlg.find('[name="numDice"]').val()) || 0;
            const faces = parseInt(dlg.find('[name="faces"]').val()) || 0;
            const modRaw = dlg.find('[name="mod"]').val().trim();
            const mod = modRaw === '' || modRaw === '-' ? 0 : parseInt(modRaw) || 0;

            if (numDice < 1 || faces < 2) return ui.notifications.warn('Número de dados o caras inválido.');

            // Crear fórmula incluyendo el mod
            const formula = mod !== 0 ? `${numDice}d${faces}${mod > 0 ? '+' : ''}${mod}` : `${numDice}d${faces}`;
            const result = await new Roll(formula).evaluate();

            let total = result.total;
            if (total < 0) total = 0;

            const label = `Tirada de PC: ${numDice}d${faces}${mod ? (mod>0? ' +' + mod : ' ' + mod) : ''}`;
            
            // Renderizar con el total final, reemplazando si es negativo
            let diceHtml = await result.render();
            if (result.total < 0) {
              diceHtml = diceHtml.replace(/-\d+/g, '0');
            }

            await ChatMessage.create({
              speaker: ChatMessage.getSpeaker({ actor: this.actor.id }),
              flags: {'ratasenlasparedes':{'text':label, 'detail': total}},
              flavor: label,
              content: diceHtml,
              rolls: [result]
            });

            if (total <= 0) return;
            const current = Number(this.actor.system.pc?.value || 0);
            let newPc = current - total;
            if (newPc < 0) newPc = 0;
            await this.actor.update({'system.pc.value': newPc});
          }
        }
      },
      default: 'roll',
      classes: ['ratas-difficulty-dialog']
    });

    dialog.render(true);
  }

  /* -------------------------------------------- */

  /** @override */
  async _onDrop(event) {
    const data = TextEditor.getDragEventData(event);

    // Permitir al GM mover objetos entre actores (borrar del origen)
    if (game.user.isGM && data.type === "Item" && data.uuid) {
      const sourceItem = await fromUuid(data.uuid);
      if (sourceItem && sourceItem.actor && sourceItem.actor.uuid !== this.actor.uuid) {
        // Restricción: No permitir pasar Hechizos o Estigmas de Character a NPC
        if (sourceItem.actor.type === "character" && (sourceItem.type === "spell" || sourceItem.type === "stigma")) {
          ui.notifications.warn("No puedes transferir Hechizos o Estigmas de un Personaje a un NPC.");
          return false;
        }

        const created = await super._onDrop(event);
        if (created && created.length > 0) {
          await sourceItem.actor.deleteEmbeddedDocuments("Item", [sourceItem.id]);
        }
        return created;
      }
    }

    return super._onDrop(event);
  }

  /**
   * Handle creating a new Owned Item for the actor using initial data defined in the HTML dataset
   * @param {Event} event   The originating click event
   * @private
   */
  async _onItemCreate(event) {
    event.preventDefault();

    // Get the tab we're in
    const header = event.currentTarget.closest('.tab');
    const tabName = header?.dataset.tab;

    // Define allowed types per tab
    const allowedTypes = {
      items: ['weapon', 'armor'],
      spells: ['spell'],
      stigmaes: ['stigma'],
      resources: ['item']
    };

    const types = allowedTypes[tabName];
    let itemData;

    // Solo mostramos el diálogo si hay más de un tipo posible
    if (types && types.length > 1) {
      itemData = await ItemTypeSelection.create(this.actor, types);
    } else if (types && types.length === 1) {
      // Si solo hay uno, lo creamos directamente
      itemData = {
        name: "Objeto",
        type: types[0]
      };
    } else {
      // Si no está definido en el mapa, mostramos el selector por defecto
      itemData = await ItemTypeSelection.create(this.actor, types);
    }

    if (!itemData) return; // User cancelled

    // Create the item
    return this.actor.createEmbeddedDocuments("Item",[itemData]);
  }
  
  /**
   * Organize and classify Items for Character sheets.
   *
   * @param {Object} actorData The actor to prepare.
   *
   * @return {undefined}
   */
  _prepareCharacterItems(sheetData) {
    const actorData = sheetData;

    // Initialize containers.
    const gear = [];
    const profesion = [];
    const reputation = [];
    const weapon = [];
    const stigma = [];
    const mean = [];
    const spell = [];
    const resource = [];

    // Iterate through items, allocating to containers
    // let totalWeight = 0;
    for (let i of sheetData.items) {
      let item = i.data;
      i.img = i.img || "icons/svg/mystery-man.svg";
      // Append to gear.
      if (i.type === 'item') {
        resource.push(i);
      }
      // Append to armor as gear
      else if (i.type === 'armor') {
        gear.push(i);
      }
      // Append to profesion.
      else if (i.type === 'profesion') {
        profesion.push(i);
      }
      // Append to reputation.
      else if (i.type === 'reputation') {
        reputation.push(i);
      }
      // Append to weapons.
      else if (i.type === 'weapon') {
        weapon.push(i);
      }
      // Append to stigma.
      else if (i.type === 'stigma') {
        stigma.push(i);
      }
      // Append to mean.
      else if (i.type === 'mean') {
        mean.push(i);
      }
      // Append to spell.
      else if (i.type === 'spell') {
        spell.push(i);
      }
    }

    // Assign and return
    actorData.gear = gear;
    actorData.profesion = profesion[0];
    actorData.reputation = reputation[0];
    actorData.weapon = weapon;
    actorData.stigma = stigma;
    actorData.mean = mean;
    actorData.spell = spell;
    actorData.resource = resource;
  }


  /**
   * Handle clickable rolls.
   * @param {Event} event   The originating click event
   * @private
   */
  async _onRoll(event) {
    event.preventDefault();
    const dataset = event.currentTarget.dataset;
    const rollType = dataset.rollType;
    
    if (!dataset.roll) return;

    if (dataset.rollType === "weapon") {
        try {
            const dialogContent = await renderTemplate("systems/ratasenlasparedes/templates/dialogs/difficulty-dialog.html", {
                title: `Tirada de ${dataset.label}`
            });

            let difficulty = await new Promise(resolve => {
                new Dialog({
                    title: "Dificultad de la Tirada",
                    content: dialogContent,
                    buttons: {
                        roll: {
                            icon: '<i class="fas fa-dice-d20"></i>',
                            label: "Tirar",
                            callback: html => {
                                const selected = html.find('[name="difficulty"]:checked');
                                return resolve(selected.val());
                            }
                        }
                    },
                    default: "roll",
                    classes: ["ratas-difficulty-dialog"]
                }).render(true);
            });

            // Preparar la tirada con la dificultad seleccionada
            const difficultyText = difficulty === "+2" ? "fácil" : 
                                  difficulty === "-2" ? "difícil" : 
                                  "normal";

            const modText = difficulty === "0" ? "" : ` (${difficulty})`;
            const rollString = difficulty === "0" ? dataset.roll : `${dataset.roll} ${difficulty}`;
            const roll = new Roll(rollString, this.actor.system);
            foundry.audio.AudioHelper.play({src: CONFIG.sounds.dice, volume: 0.8, autoplay: true, loop: false}, true);
            const result = await roll.evaluate();
            
            // Mostrar dados 3D si están disponibles
            if (game.dice3d) {
                await game.dice3d.showForRoll(result, game.user, true);
            }

            // Determinar el resultado
            let label = dataset.label ? `Usa su <strong>${dataset.label}</strong>.` : '';
            let goal;

            if (result.total <= 7) {
                label += ` <strong>Falla</strong> y sufre <a class="content-link" data-pack="ratasenlasparedes.ayudas" data-lookup="Consecuencias" draggable="true"><i class="fas fa-book-open"></i> dos Consecuencias</a>.`;
                goal = "Fallo";
            } else if (result.total <= 9) {
                label += ` Tiene <strong>éxito</strong>, pero sufre <a class="content-link" data-pack="ratasenlasparedes.ayudas" data-lookup="Consecuencias" draggable="true"><i class="fas fa-book-open"></i> una Consecuencia</a>`;
                goal = "Parcial";
            } else if (result.total <= 11) {
                label += ` Tiene <strong>éxito</strong> y elige <a class="content-link" data-pack="ratasenlasparedes.ayudas" data-lookup="Consecuencias" draggable="true"><i class="fas fa-book-open"></i> una Consecuencia</a> para su objetivo.`;
                goal = "Exito";
            } else {
                label += ` Tiene <strong>éxito</strong> y elige <a class="content-link" data-pack="ratasenlasparedes.ayudas" data-lookup="Consecuencias" draggable="true"><i class="fas fa-book-open"></i> dos Consecuencias</a> para su objetivo.`;
                goal = "¡Oh sí!";
            }

            // Renderizar el resultado de la tirada
            const html = await result.render();

            // Crear un solo mensaje en el chat
            await ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: this.actor }),
                flags: {'ratasenlasparedes':{'text':label, 'goal':goal}},
                rolls: [result],
                content: html
            });
        } catch (error) {
            console.error("Error en la tirada de arma:", error);
        }
    }
    
    else if (dataset.rollType === "damage") {
        const damageMod = Array.from(this.actor.items).reduce((acu, current) => {
            if (current.system.type === "Efecto" && current.system.value === "Daño") {
                return acu + parseInt(current.system.mod);
            }
            return acu;
        }, 0);

        const damageString = damageMod === 0 ? dataset.roll : `${dataset.roll} + (${damageMod})`;
        const roll = new Roll(damageString);
        foundry.audio.AudioHelper.play({src: CONFIG.sounds.dice, volume: 0.8, autoplay: true, loop: false}, true);
        const result = await roll.evaluate();
        if (game.dice3d) {
            await game.dice3d.showForRoll(result, game.user, true);
        }
        const html = await result.render();

        const label = dataset.label ? `Causa daño con su <strong>${dataset.label}</strong>.` : '';

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            flags: {'ratasenlasparedes':{'text':label}},
            content: html,
            rolls: [result]
        });
    }
  }
}
