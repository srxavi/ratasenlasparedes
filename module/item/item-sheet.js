/**
 * Dialog for selecting item types
 * @extends {Dialog}
 */
export class ItemTypeSelection extends Dialog {
  static async create(actor, allowedTypes = null) {
    const allTypes = {
      item: "Objeto",
      weapon: "Arma",
      armor: "Armadura",
      spell: "Hechizo",
      profesion: "Profesión",
      reputation: "Reputación",
      mean: "Objeto",
      stigma: "Estigma"
    };

    // Filter types if allowedTypes is provided
    const itemTypes = allowedTypes
      ? Object.fromEntries(Object.entries(allTypes).filter(([type]) => allowedTypes.includes(type)))
      : allTypes;

    const content = `
      <form class="item-type-selection">
        <div class="form-group">
          <label class="selection-label">Tipo de Item:</label>
          <select name="type" id="type" class="type-select">
            ${Object.entries(itemTypes).map(([type, label]) => `<option value="${type}">${label}</option>`).join('')}
          </select>
        </div>
      </form>`;

    return new Promise((resolve) => {
      new Dialog({
        title: "Crear Nuevo Item",
        content,
        buttons: {
          create: {
            icon: '<i class="fas fa-check"></i>',
            label: "Crear",
            callback: (html) => {
              const type = html.find('[name="type"]').val();
              const itemData = {
                name: `Nuevo ${itemTypes[type]}`,
                type: type
              };
              resolve(itemData);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancelar",
            callback: () => resolve(null)
          }
        },
        default: "create",
        classes: ['item-creation'],
        width: 300
      }).render(true);
    });
  }
}

export class ratasenlasparedesItemSheet extends ItemSheet {

  /** @override */
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["ratasenlasparedes", "sheet", "item"],
      width: 460,
      height: 520,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "description" }]
    });
  }

  /** @override */
  get template() {
    const path = "systems/ratasenlasparedes/templates/item";
    const defaultTemplate = `${path}/item-sheet.html`;
    
    // Si el item o su tipo no están definidos, usa el template por defecto
    if (!this.item?.type) {
      console.warn("Item type undefined, using default template");
      return defaultTemplate;
    }
    
    if (this.item.type === 'stigma') {
      return `${path}/stigma-sheet.html`;
    }
    
    // Intenta usar el template específico del tipo, si falla usa el por defecto
    try {
      return `${path}/${this.item.type}-sheet.html`;
    } catch(e) {
      console.warn(`Failed to load template for type ${this.item.type}, using default`);
      return defaultTemplate;
    }
  }

  /* -------------------------------------------- */

  /** @override */
  async getData() {
    // Get data from super
    const context = await super.getData();
    
    // Fix [object Object] bug: ensure description is always a string in all possible paths
    const system = this.item.system;
    if (typeof system.description !== "string") system.description = "";
    context.system = system;

    // Initialize system data if undefined
    if (!system) {
      this.item.system = {};
    }
    
    // Handle mean and stigma specific data
    if (this.item.type === 'stigma') {
      context.system.atributo = this.item.system.atributo || "ninguno";
      context.system.type = this.item.system.type || "";
    }
    if (this.item.type === 'profesion' || this.item.type === 'reputation') {
      context.system.selectorType = this.item.system.selectorType || "ninguno";
      context.system.selectorValue = this.item.system.selectorValue || 0;
    }    
    // Handle weapon-specific fields
    if (this.item.type === "weapon") {
      context.system.damage = this.item.system.damage || "";
    }    // Ensure spell-specific fields exist if this is a spell
    if (this.item.type === "spell") {
      context.system.efect = this.item.system.efect || "1d6";
    }
    
    // In V13, enrichHTML is required for proper editor functionality
    // Aseguramos que la descripción sea siempre una cadena de texto antes de enriquecerla,
    context.enrichedDescription = await TextEditor.enrichHTML(system.description, {
      secrets: this.document.isOwner,
      relativeTo: this.document
    });
    
    // Ensure core properties exist
    context.name = this.document.name || "";
    context.img = this.document.img || "icons/svg/item-bag.svg";
    context.editable = this.isEditable;
    
    console.log("Sheet getData:", context); // Debug log
    
    return context;
  }

  /* -------------------------------------------- */

  /** @override */
  setPosition(options = {}) {
    const position = super.setPosition(options);
    const sheetBody = this.element.find(".sheet-body");
    const bodyHeight = position.height - 192;
    sheetBody.css("height", bodyHeight);
    return position;
  }

  /* -------------------------------------------- */

  /** @override */
  activateListeners(html) {
    super.activateListeners(html);

    // Everything below here is only needed if the sheet is editable
    if (!this.options.editable) return;

    // Add change listeners to all form inputs
    html.find('input,select,textarea').on('change', async (event) => {
      event.preventDefault();
      const element = event.target;
      const field = element.name;
      const dtype = element.dataset.dtype;
      
      // Process the value based on its data type
      let value = element.value;
      if (dtype === "Number" && value !== "") {
        value = Number(value);
      }

      console.log(`Updating field ${field} with value:`, value, `(${dtype})`); // Debug log

      // Update the item with the proper data structure
      const updateData = {};
      if (field.startsWith('system.')) {
        updateData[field] = value;
      } else {
        updateData[field] = value;
      }

      await this.item.update(updateData);
    });
  }
}
