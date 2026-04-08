// Import Modules
import { ratasenlasparedesActor } from "./actor/actor.js";
import { ratasenlasparedesActorSheet } from "./actor/actor-sheet.js";
import { ratasenlasparedesNpcSheet } from "./actor/npc-sheet.js";
import { ratasenlasparedesContainerSheet } from "./actor/container-sheet.js";
import { ratasenlasparedesItem } from "./item/item.js";
import { ratasenlasparedesItemSheet } from "./item/item-sheet.js";


Hooks.once('init', async function () {
    // Cargar estilos
    const styles = ['dialog.css'];
    styles.forEach(s => {
        const link = document.createElement('link');
        link.type = 'text/css';
        link.rel = 'stylesheet';
        link.href = 'systems/ratasenlasparedes/css/' + s;
        document.getElementsByTagName('head')[0].appendChild(link);
    });

    CONFIG.ChatMessage.template = "systems/ratasenlasparedes/templates/chat/chat-message.html";
    CONFIG.Dice.template = "systems/ratasenlasparedes/templates/dice/roll.html";
    CONFIG.Dice.tooltip = "systems/ratasenlasparedes/templates/dice/tooltip.html";
    Roll.CHAT_TEMPLATE = "systems/ratasenlasparedes/templates/dice/roll.html"
    Roll.TOOLTIP_TEMPLATE = "systems/ratasenlasparedes/templates/dice/tooltip.html"

    game.ratasenlasparedes = {
        ratasenlasparedesActor,
        ratasenlasparedesItem
    };

    // Solo el GM puede borrar mensajes
    CONFIG.ChatMessage.documentClass.prototype.canUserModify = function(user, action) {
        return user.isGM;
    };

    // Manejar el borrado de mensajes individuales
    Hooks.on('renderChatMessageHTML', (message, html, data) => {
        if (game.user.isGM) {
            const deleteBtn = html.querySelector('.message-delete');
            if (deleteBtn) deleteBtn.addEventListener('click', ev => {
                ev.preventDefault();
                message.delete();
            });
        }
    });

    /**
     * Set an initiative formula for the system
     * @type {String}
     */
    CONFIG.Combat.initiative = {
        formula: "1d6",
        decimals: 2
    };
    // Define custom Document classes
    CONFIG.Actor.documentClass = ratasenlasparedesActor;
    CONFIG.Item.documentClass = ratasenlasparedesItem;

    // Register sheet application classes
    Actors.registerSheet("ratasenlasparedes", ratasenlasparedesActorSheet, {
        types: ['character'],
        makeDefault: true
    });
    Actors.registerSheet("ratasenlasparedes", ratasenlasparedesNpcSheet, {
        types: ['npc'],
        makeDefault: true
    });
    Actors.registerSheet("ratasenlasparedes", ratasenlasparedesContainerSheet, {
        types: ['container'],
        makeDefault: true
    });
    Actors.unregisterSheet("core", ActorSheet);

    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("ratasenlasparedes", ratasenlasparedesItemSheet, { makeDefault: true });

    // Agregar helper de Handlebars para comparaciones
    Handlebars.registerHelper('eq', function(a, b) {
        return a === b;
    });

    Handlebars.registerHelper('or', function() {
        return Array.prototype.slice.call(arguments, 0, -1).some(Boolean);
    });

    // Si necesitas agregar más hooks del chat, agrégalos aquí

    // If you need to add Handlebars helpers, here are a few useful examples:
    Handlebars.registerHelper('concat', function () {
        var outStr = '';
        for (var arg in arguments) {
            if (typeof arguments[arg] != 'object') {
                outStr += arguments[arg];
            }
        }
        return outStr;
    });

    Handlebars.registerHelper('toLowerCase', function (str) {
        return str.toLowerCase();
    });

    Hooks.on("preCreateItem", (document, data, options, userId) => {
        // Asignar imágenes por defecto según el tipo si no tienen una personalizada
        if (!data.img || data.img === "icons/svg/item-bag.svg") {
            const defaultImages = {
                "weapon": "icons/svg/sword.svg", // Cambia estas rutas por las tuyas
                "armor": "icons/svg/shield.svg",
                "spell": "icons/svg/explosion.svg",
                "profesion": "icons/svg/book.svg",
                "reputation": "icons/svg/book.svg",
                "stigma": "icons/svg/book.svg"
            };
            
            if (defaultImages[document.type]) {
                document.updateSource({ img: defaultImages[document.type] });
            }
        }

        if (data.name === "Objeto") {
            const itemType = data.type;

            const typeTranslations = {
                "item": "Objeto",
                "weapon": "Arma",
                "armor": "Armadura",
                "spell": "Hechizo",
                "profesion": "Profesión",
                "reputation": "Reputación",
                "mean": "Manía",
                "stigma": "Estigma"
            };

            const feminineSpanishTypes = ["Arma", "Armadura", "Profesión", "Reputación", "Manía"];

            const translatedType = typeTranslations[itemType] || itemType.charAt(0).toUpperCase() + itemType.slice(1);

            let newName;
            if (feminineSpanishTypes.includes(translatedType)) {
                newName = `Nueva ${translatedType}`;
            } else {
                newName = `Nuevo ${translatedType}`;
            }

            document.updateSource({ name: newName });
        }
    });

    Hooks.on("preCreateActor", (actor, data, options, userId) => {
        if (actor.type === "container") {
            actor.updateSource({ "ownership": { "default": 3 } });
        }
    });

    Hooks.on("preUpdateActor", (actor, update, options, userId) => {
        if (actor.type !== 'character' || !update.system) {
            return;
        }
    
        // CORRECCIÓN: Usar toObject() o deepClone para evitar modificar el actor in-place
        const currentSystemData = actor.system.toObject ? actor.system.toObject() : foundry.utils.deepClone(actor.system);
        
        // Calculamos el sistema 'futuro' sin alterar el actual
        const prospectiveSystem = foundry.utils.mergeObject(currentSystemData, update.system);

        // --- stigma modifiers ---
        let pvstigmaModifier = 0;
        let pcstigmaModifier = 0;
        const stigmas = actor.items.filter(i => i.type === 'stigma');
        for (const stigma of stigmas) {
            // Ensure stigma has system data before accessing it
            if (!stigma.system) continue;

            if (stigma.system.type === 'stigma' && stigma.system.atributo === 'pv') {
                pvstigmaModifier -= 1;
            }
            if (stigma.system.type === 'mean' && stigma.system.atributo === 'pv') {
                pvstigmaModifier += 1;
            }
            if (stigma.system.type === 'mean' && stigma.system.atributo === 'pc') {
                pcstigmaModifier += 1;
            }
            if (stigma.system.type === 'stigma' && stigma.system.atributo === 'pc') {
                pcstigmaModifier -= 1;
            }
        }
        // Añadir modificadores directos desde Profesión/Reputación si aplican a PC/PV
        const profs = actor.items.filter(i => i.type === 'profesion' || i.type === 'reputation');
        for (const p of profs) {
            if (!p.system) continue;
            const sel = p.system.selectorType;
            const val = parseInt(p.system.selectorValue) || 0;
            if (sel === 'pv') pvstigmaModifier += val;
            if (sel === 'pc') pcstigmaModifier += val;
        }
    
        // --- PV Ceiling and Clamping ---
        const musculo = prospectiveSystem.abilities.mus.value || 0;
        const pvCeiling = 10 + musculo + pvstigmaModifier;
    
        // Verificar si el usuario está actualizando manualmente el PV Max
        if (foundry.utils.hasProperty(update, "system.pv.max")) {
            // Actualización manual: limitamos al techo calculado
            const manualValue = foundry.utils.getProperty(update, "system.pv.max");
            const clampedValue = Math.min(manualValue, pvCeiling);
            foundry.utils.setProperty(update, "system.pv.max", clampedValue);
        } else {
            // Sin actualización manual: Forzamos la sincronización si está fuera de rango
            // Si el actual es menor al techo (subió musculo), lo subimos.
            // Si el actual es mayor al techo (bajó musculo), lo bajamos.
            if (actor.system.pv.max !== pvCeiling) {
                // Opcional: Si quieres permitir que sea menor (daño permanente), cambia !== por <
                // Pero para automatización completa, usa !== o la lógica de abajo:
                if (actor.system.pv.max < pvCeiling) {
                    foundry.utils.setProperty(update, "system.pv.max", pvCeiling);
                } else if (actor.system.pv.max > pvCeiling) {
                    foundry.utils.setProperty(update, "system.pv.max", pvCeiling);
                }
            }
        }

        // Obtener el valor final de PV Max que tendrá el actor tras este update
        const finalMaxPVForValueClamping = foundry.utils.hasProperty(update, "system.pv.max") 
            ? foundry.utils.getProperty(update, "system.pv.max") 
            : actor.system.pv.max;
        
        // Clamping del valor actual de PV (Vida)
        if (foundry.utils.hasProperty(update, "system.pv.value")) {
            const manualPvValue = foundry.utils.getProperty(update, "system.pv.value");
            if (manualPvValue > finalMaxPVForValueClamping) {
                foundry.utils.setProperty(update, "system.pv.value", finalMaxPVForValueClamping);
            }
        }
    
        // --- PC Ceiling and Clamping ---
        const voluntad = prospectiveSystem.abilities.vol.value || 0;
        const hechizos = actor.items.filter(i => i.type === 'spell').length;
        const pcCeiling = 10 + voluntad - hechizos + pcstigmaModifier;
        
        // Verificar si el usuario está actualizando manualmente el PC Max
        if (foundry.utils.hasProperty(update, "system.pc.max")) {
            // Actualización manual
            const manualValue = foundry.utils.getProperty(update, "system.pc.max");
            const clampedValue = Math.min(manualValue, pcCeiling);
            foundry.utils.setProperty(update, "system.pc.max", clampedValue);
        } else {
            // Sin actualización manual: Ajuste automático
            if (actor.system.pc.max !== pcCeiling) {
                 if (actor.system.pc.max < pcCeiling) {
                    foundry.utils.setProperty(update, "system.pc.max", pcCeiling);
                } else if (actor.system.pc.max > pcCeiling) {
                    foundry.utils.setProperty(update, "system.pc.max", pcCeiling);
                }
            }
        }
    
        // Obtener el valor final de PC Max
        const finalMaxPCForValueClamping = foundry.utils.hasProperty(update, "system.pc.max") 
            ? foundry.utils.getProperty(update, "system.pc.max") 
            : actor.system.pc.max;

        // Clamping del valor actual de PC (Cordura)
        if (foundry.utils.hasProperty(update, "system.pc.value")) {
            const manualPcValue = foundry.utils.getProperty(update, "system.pc.value");
            if (manualPcValue > finalMaxPCForValueClamping) {
                foundry.utils.setProperty(update, "system.pc.value", finalMaxPCForValueClamping);
            }
        }
    });
});

Handlebars.registerHelper('json', function (context) {
    return JSON.stringify(context);
});

Hooks.on('createItem', (sheet, aux, itemId) => {
    let profesions = sheet.actor.items.filter(i => i.type == "profesion");
    let reputations = sheet.actor.items.filter(i => i.type == "reputation");
    if (sheet.type == "profesion" && profesions.length > 1) {
        sheet.actor.deleteEmbeddedDocuments("Item", [profesions[0].id]);
    }
    if (sheet.type == "reputation" && reputations.length > 1) {
        sheet.actor.deleteEmbeddedDocuments("Item", [reputations[0].id]);
    }
});

Hooks.on("preCreateScene", (scene, data, options, userID) => {
    scene.updateSource({ backgroundColor: '#000000' });
})


/* hide ui elements on logo click */
Hooks.on('ready', () => {
    $('#logo').click(ev => {
        window.hideUI = !window.hideUI;
        if (window.hideUI) {
            $('#sidebar').hide();
            $('#navigation').hide();
            $('#controls').hide();
            $('#players').hide();
            $('#hotbar').hide();
        } else {
            $('#sidebar').show();
            $('#navigation').show();
            $('#controls').show();
            $('#players').show();
            $('#hotbar').show();
        }
    });

    $('#chat-controls .fa-dice-d20').addClass("fa-dice-d6");
    $('#chat-controls .fa-dice-d20').removeClass("fa-dice-d20");



    $(document).on('click', '#chat-controls .fa-dice-d6', ev => {
        const dialogOptions = {
            width: 420,
            top: event.clientY - 80,
            left: window.innerWidth - 710,
            classes: ['dialog', 'ratas-dice-roller'],
        };
        let templateData = {
            title: 'Lanzador',
            rollClass: 'ratas-simple-roller-roll',
        };
        // Render the modal.
        renderTemplate('systems/ratasenlasparedes/templates/roller.html', templateData).then(dlg => {
            let dialogRoller = new Dialog({
                title: 'Lanzador',
                content: dlg,
                buttons: {
                }
            }, dialogOptions);
            dialogRoller.render(true);
        });
    });

    $(document).on('click', '.ratas-simple-roller-roll', async ev => {
        let roll = new Roll(String($(ev.currentTarget).data('formula')));
        await roll.evaluate();
        roll.toMessage();
    });

    $(document).on('click', '.ratas-sanity-check', async ev => {
        let roll = new Roll(String($(ev.currentTarget).data('formula')));
        let actorId = String($(ev.currentTarget).data('actor-id'));
        await roll.evaluate();
        let label = "Perdida de cordura.";
        let sanityData = {
            speaker: ChatMessage.getSpeaker({ actor: actorId }),
            flags: {'ratasenlasparedes':{'text':label, 'detail': roll.total}},
            flavor: label
        };

        roll.toMessage(sanityData);
        if (roll.total < 0) return;
        let pcMinus = game.actors.get(actorId).system.pc.value - roll.total;
        (pcMinus < 0) ? pcMinus = 0 : pcMinus = pcMinus;
        game.actors.get(actorId).update({ _id: actorId, 'system.pc.value': pcMinus });
    });

    // Mover la línea que causa el error al hook 'ready' y usar jQuery para mayor fiabilidad
    $('#logo').attr("src", "/systems/ratasenlasparedes/img/thp.png");
});

Hooks.on('renderSceneNavigation', (app, html) => {
    if (window.hideUI) {
        html.hide();
    }
});

Hooks.on('renderSceneControls', (app, html) => {
    if (window.hideUI) {
        html.hide();
    }
});

Hooks.on('renderSidebarTab', (app, html) => {
    if (window.hideUI) {
        html.hide();
    }
});

Hooks.on('renderCombatTracker', (app, html) => {
    if (window.hideUI) {
        html.hide();
    }
});


//Chat Messages
Hooks.on("createChatMessage", async (chatMSG, flags, userId) => {
    if (game.user.isGM) {
        const actor = game.actors.get(chatMSG.speaker.actor);
        await chatMSG.setFlag("ratasenlasparedes", "profileImg", actor ? actor.img : game.user.avatar);
        if (chatMSG.isRoll) {
            const existingDetail = chatMSG.getFlag("ratasenlasparedes", "detail");
            if (existingDetail === undefined || existingDetail === null) {
                await chatMSG.setFlag("ratasenlasparedes", "detail", chatMSG.rolls?.[0]?.total);
            }
        }
    }
    //     console.log(actor);

    let messageId = chatMSG._id;
    let msg = game.messages.get(messageId);
    let msgIndex = game.messages.documentName.indexOf(msg);

    if (chatMSG.isRoll && chatMSG.isContentVisible) {
        let rollData = {
            //flavor: ChatMSG.getFlag('ratasenlasparedes', 'text'),
            formula: chatMSG.rolls[0]?.formula,
            username: game.user.name,
        };
        // console.log(rollData);
    }


});