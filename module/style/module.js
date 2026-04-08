// Define el ID de tu módulo
const MODULE_ID = "ratasenlasparedes";

// Define la configuración de tus compendios
const compendiumThemes = [
  {
    dataPack: `${MODULE_ID}.armas`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-tint",
    bannerImage: `systems/${MODULE_ID}/img/art/banner1.jpeg`,
  },
  {
    dataPack: `${MODULE_ID}.ayudas`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-dot-circle",
    bannerImage: `systems/${MODULE_ID}/img/art/banner2.jpeg`,
  },
  {
    dataPack: `${MODULE_ID}.equipo`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-gavel",
    bannerImage: `systems/${MODULE_ID}/img/art/banner3.png`,
  },
  {
    dataPack: `${MODULE_ID}.profesiones`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-user-secret",
    bannerImage: `systems/${MODULE_ID}/img/art/banner4.jpeg`,
  },
  {
    dataPack: `${MODULE_ID}.reputaciones`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-user-secret",
    bannerImage: `systems/${MODULE_ID}/img/art/banner5.jpeg`,
  },
  {
    dataPack: `${MODULE_ID}.hechizos`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-user-secret",
    bannerImage: `systems/${MODULE_ID}/img/art/banner6.jpeg`,
  },
  {
    dataPack: `${MODULE_ID}.experiencia`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-user-secret",
    bannerImage: `systems/${MODULE_ID}/img/art/banner7.jpeg`,
  },
  {
    dataPack: `${MODULE_ID}.tablas`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-user-secret",
    bannerImage: `systems/${MODULE_ID}/img/art/banner8.jpeg`,
  },
  {
    dataPack: `${MODULE_ID}.antagonistas`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-user-secret",
    bannerImage: `systems/${MODULE_ID}/img/art/banner9.jpeg`,
  },
  {
    dataPack: `${MODULE_ID}.horrores-tras-los-muros-de-la-cordura`,
    colorText: "#ff5252",
    iconText: "fa-solid fa-user-secret",
    bannerImage: `systems/${MODULE_ID}/img/art/banner10.jpeg`,
  }
];

// Conjunto para almacenar los IDs de las ventanas emergentes que están siendo procesadas
const bannersBeingApplied = new Set();
// Map para almacenar MutationObservers asociados a cada popout (para limpiar al cerrar)
// Guardamos un objeto { imgObserver, sectionObserver } por popoutId
const popoutObservers = new Map();

// Función para crear y configurar las carpetas de compendios
async function createCompendiumFolders() {
  const folderName = "Ratas en las Paredes";
  let folder = game.folders.contents.find(f => f.name === folderName && f.type === "Compendium");

  if (!folder) {
    try {
      folder = await Folder.create({
        name: folderName,
        type: "Compendium",
        sorting: "m",
        color: "#43025C"
      });
      console.log(`${MODULE_ID} | Carpeta "${folderName}" creada.`);
    } catch (error) {
      console.error(`${MODULE_ID} | Error al crear la carpeta "${folderName}":`, error);
      return;
    }
  }

  const packsToMove = compendiumThemes.map(theme => theme.dataPack);

  for (const packId of packsToMove) {
    let pack = game.packs.get(packId);
    if (pack && pack.folder?.id !== folder.id) {
      try {
        await pack.configure({ folder: folder.id });
        console.log(`${MODULE_ID} | Paquete "${pack.title}" movido a la carpeta "${folderName}".`);
      } catch (error) {
        console.error(`${MODULE_ID} | Error al mover el paquete "${pack.title}":`, error);
      }
    }
  }
}

// Función para aplicar el banner personalizado a una ventana de compendio
function applyCompendiumBanner(popoutSection) {
  const popoutId = popoutSection.id;
  if (!popoutId) return;

  const dataPackId = popoutId.replace('compendium-', '').replace(/_/g, '.');
  const theme = compendiumThemes.find(t => t.dataPack === dataPackId);
  
  if (!theme?.bannerImage) {
    bannersBeingApplied.delete(popoutId);
    return;
  }

  const mainBannerImg = popoutSection.querySelector('.header-banner img');
  if (!mainBannerImg) {
    bannersBeingApplied.delete(popoutId);
    return;
  }

  const absoluteCustomBannerImage = new URL(theme.bannerImage, window.location.href).href;
  let attempts = 0;
  const maxAttempts = 20;
  const intervalTime = 75;

  const trySetBanner = () => {
    attempts++;
    if (mainBannerImg.hasAttribute('loading')) {
      mainBannerImg.removeAttribute('loading');
    }

    if (mainBannerImg.src !== absoluteCustomBannerImage) {
      mainBannerImg.src = theme.bannerImage;
      if (attempts < maxAttempts) {
        setTimeout(trySetBanner, intervalTime);
      } else {
        bannersBeingApplied.delete(popoutId);
      }
    } else {
      bannersBeingApplied.delete(popoutId);
    }
  };

  trySetBanner();

  // Además, crear dos MutationObservers:
  // 1) Un observer sobre el atributo 'src' de la imagen para reaplicarla si Foundry la sobrescribe.
  // 2) Un observer sobre la sección del popout para detectar reemplazos completos del header/banner
  //    (Foundry a veces reconstruye la cabecera al añadir o actualizar elementos), y así volver a
  //    enganchar al nuevo <img> cuando aparezca.
  try {
    // Si ya existe un observer para este popout, desconectarlos primero
    const existing = popoutObservers.get(popoutId);
    if (existing) {
      try { existing.imgObserver?.disconnect(); } catch(e) {}
      try { existing.sectionObserver?.disconnect(); } catch(e) {}
      popoutObservers.delete(popoutId);
    }

    const createImgObserverFor = (imgEl) => {
      if (!imgEl) return null;
      const observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === 'attributes' && m.attributeName === 'src') {
            // Reaplicar si Foundry cambia el src
            if (imgEl.src !== absoluteCustomBannerImage) {
              console.log(`${MODULE_ID} | DEBUG: popout ${popoutId} header src cambiado por Foundry — reaplicando banner.`);
              imgEl.src = theme.bannerImage;
            }
          }
        }
      });
      observer.observe(imgEl, { attributes: true, attributeFilter: ['src'] });
      return observer;
    };

    // Observer para detectar cuando el header/banner es reemplazado dentro del popout
    const sectionObserver = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList') {
          // Bustigma si hay una nueva imagen del header
          const newImg = popoutSection.querySelector('.header-banner img');
          if (newImg) {
            // Reaplicar inmediatamente
            if (newImg.src !== absoluteCustomBannerImage) newImg.src = theme.bannerImage;
            // Reconectar observer de atributos a la nueva imagen
            try {
              const prev = popoutObservers.get(popoutId)?.imgObserver;
              if (prev) prev.disconnect();
            } catch (e) {}
            const newImgObs = createImgObserverFor(newImg);
            const stored = popoutObservers.get(popoutId) || {};
            stored.imgObserver = newImgObs;
            popoutObservers.set(popoutId, stored);
          }
        }
      }
    });

    // Crear imgObserver sobre la imagen actual
    const imgObserver = createImgObserverFor(mainBannerImg);
    // Empezar a observar el popoutSection para cambios que reemplacen el header
    sectionObserver.observe(popoutSection, { childList: true, subtree: true });

    popoutObservers.set(popoutId, { imgObserver, sectionObserver });
  } catch (err) {
    console.warn(`${MODULE_ID} | No se pudo crear observer para popout ${popoutId}:`, err);
  }
}

// Inicialización del módulo
Hooks.once('init', () => {
  console.log(`${MODULE_ID} | Initializing`);
});

// Configuración cuando el módulo está listo
Hooks.once('ready', () => {
  console.log(`${MODULE_ID} | Ready`);
  createCompendiumFolders();

  // Observador para detectar nuevas ventanas emergentes
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList') {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const popoutSection = node.matches('section[id^="compendium-"].sidebar-popout') 
              ? node 
              : node.querySelector('section[id^="compendium-"].sidebar-popout');
            
            if (popoutSection && !bannersBeingApplied.has(popoutSection.id)) {
              bannersBeingApplied.add(popoutSection.id);
              applyCompendiumBanner(popoutSection);
            }
          }
        });
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
});

// Hook para cambiar banners en el directorio de compendios
Hooks.on("renderCompendiumDirectory", (app, html) => {
  const rootElement = html instanceof HTMLElement ? html : html[0];
  if (!rootElement) return;

  const compendiumItems = rootElement.querySelectorAll('li.directory-item.compendium');
  compendiumItems.forEach(item => {
    const dataPack = item.dataset.pack;
    const theme = compendiumThemes.find(t => t.dataPack === dataPack);
    
    if (theme) {
      const bannerImg = item.querySelector('img.compendium-banner');
      if (bannerImg) {
        bannerImg.src = theme.bannerImage;
      }
    }
  });

  // Verificar si es una ventana emergente y aplicar el banner
  const appElement = app?.element instanceof HTMLElement ? app.element : app?.element?.[0];
  if (appElement?.classList.contains('sidebar-popout')) {
    const popoutSection = appElement.matches('section[id^="compendium-"]') 
      ? appElement 
      : appElement.querySelector('section[id^="compendium-"]');
    
    if (popoutSection && !bannersBeingApplied.has(popoutSection.id)) {
      bannersBeingApplied.add(popoutSection.id);
      applyCompendiumBanner(popoutSection);
    }
  }
});

// Limpiar referencias cuando se cierra una ventana
Hooks.on("closeApplication", (app) => {
  const closedAppId = app.element instanceof HTMLElement ? app.element.id : app.element?.[0]?.id;
  if (closedAppId && bannersBeingApplied.has(closedAppId)) {
    bannersBeingApplied.delete(closedAppId);
  }
  // Además, desconectar y eliminar cualquier observer asociado al popout
  const obs = popoutObservers.get(closedAppId);
  if (obs) {
    try {
      obs.disconnect();
    } catch (e) {
      /* ignore */
    }
    popoutObservers.delete(closedAppId);
  }
});
