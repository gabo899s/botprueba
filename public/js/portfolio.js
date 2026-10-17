
    (function () {
      // ===================================================================
      // 1. LAS 21 TIPOGRAFÍAS EXACTAS EN ORDEN Y CALIBRACIÓN DE ALTURA
      // ===================================================================
      const INTRO_FONTS = [
        { family: '"Noto Serif", serif', weight: '500', style: 'normal', scale: 1.00, tracking: '-0.01em' },
        { family: '"Open Sans", sans-serif', weight: '600', style: 'normal', scale: 0.98, tracking: '-0.015em' },
        { family: '"Abril Fatface", serif', weight: '400', style: 'normal', scale: 1.02, tracking: '0em' },
        { family: '"Space Mono", monospace', weight: '700', style: 'normal', scale: 0.88, tracking: '-0.04em' },
        { family: '"Lobster", cursive', weight: '400', style: 'normal', scale: 1.06, tracking: '0.01em' },
        { family: '"Space Grotesk", sans-serif', weight: '600', style: 'normal', scale: 0.98, tracking: '-0.02em' },
        { family: '"Cinzel Decorative", serif', weight: '700', style: 'normal', scale: 0.86, tracking: '0.01em' },
        { family: '"Archivo Black", sans-serif', weight: '400', style: 'normal', scale: 0.90, tracking: '-0.03em' },
        { family: '"Pacifico", cursive', weight: '400', style: 'normal', scale: 0.96, tracking: '0.01em' },
        { family: '"Anton", sans-serif', weight: '400', style: 'normal', scale: 1.06, tracking: '0.02em' },
        { family: '"Fredericka the Great", serif', weight: '400', style: 'normal', scale: 0.94, tracking: '0.01em' },
        { family: '"Righteous", sans-serif', weight: '400', style: 'normal', scale: 0.98, tracking: '0em' },
        { family: '"Aladin", system-ui', weight: '400', style: 'normal', scale: 1.12, tracking: '0.01em' },
        { family: '"Monoton", sans-serif', weight: '400', style: 'normal', scale: 0.80, tracking: '0.01em' },
        { family: '"Bangers", system-ui', weight: '400', style: 'normal', scale: 1.12, tracking: '0.03em' },
        { family: '"VT323", monospace', weight: '400', style: 'normal', scale: 1.24, tracking: '0.01em' },
        { family: '"Press Start 2P", monospace', weight: '400', style: 'normal', scale: 0.62, tracking: '-0.03em' },
        { family: '"Bebas Neue", sans-serif', weight: '400', style: 'normal', scale: 1.14, tracking: '0.03em' },
        { family: '"Syncopate", sans-serif', weight: '700', style: 'normal', scale: 0.72, tracking: '-0.03em' },
        { family: '"Poppins", sans-serif', weight: '600', style: 'normal', scale: 0.97, tracking: '-0.015em' },
        { family: '"Averia Serif Libre", Georgia, serif', weight: '400', style: 'italic', scale: 1.03, tracking: '-0.01em' }
      ];

      // 20 intervalos estrictamente decrecientes (cada cambio tarda menos que el anterior,
      // terminando en intervalos rapidísimos de 36-50ms)
      const FONT_INTERVALS_MS = [
        620, 530, 450, 380, 320,
        268, 222, 182, 148, 120,
        96,  78,  64,  54,  48,
        45,  42,  40,  38,  36
      ];

      // Tiempos maestros de la secuencia (~9.8 segundos en total)
      const INITIAL_HOLD_MS = 1700;       // 1,7s quieta y blanca en Noto Serif
      const METALLIC_HOLD_MS = 1800;      // Pausa apreciando el acabado metálico azul antes de desplazarse
      const AURA_LEAD_MS = 850;           // El aura empieza a revelarse poco antes del desplazamiento
      const FLIGHT_DURATION_MS = 2300;    // Desplazamiento suave hasta su posición en el título

      const elCurtain = document.getElementById('intro-curtain');
      const elStage = document.getElementById('intro-stage');
      const elWrapper = document.getElementById('intro-word-wrapper');
      const elIntroWord = document.getElementById('intro-word');
      const elHeroSlot = document.getElementById('hero-infinitas-slot');
      const elHeroAura = document.getElementById('hero-aura');

      const elLightDiffuse = document.getElementById('metal-light-diffuse');
      const elLightSpec1 = document.getElementById('metal-light-spec1');
      const elLightSpec2 = document.getElementById('metal-light-spec2');

      const prefersReducedMotion =
        window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      // Construir tabla acumulada de tiempos para los 21 cambios tipográficos
      const fontChangeTimestamps = [0]; // Índice 0 empieza en t = 0
      let accum = INITIAL_HOLD_MS;
      for (let i = 0; i < FONT_INTERVALS_MS.length; i++) {
        fontChangeTimestamps.push(accum);
        accum += FONT_INTERVALS_MS[i];
      }
      const TIME_ALL_FONTS_DONE = accum; // ~5581ms: llegada a Averia Serif Libre cursiva (#21)
      const TIME_AURA_START = TIME_ALL_FONTS_DONE + (METALLIC_HOLD_MS - AURA_LEAD_MS);
      const TIME_FLIGHT_START = TIME_ALL_FONTS_DONE + METALLIC_HOLD_MS;
      const TIME_SEQUENCE_END = TIME_FLIGHT_START + FLIGHT_DURATION_MS; // ~9681ms (~10s)

      let lastAppliedFontIndex = -1;
      let metallicActivated = false;
      let auraActivated = false;
      let revealTriggered = false;
      let sequenceCompleted = false;
      let animationFrame, disposed = false;

      function applyIntroFont(index) {
        if (index === lastAppliedFontIndex || index < 0 || index >= INTRO_FONTS.length) return;
        lastAppliedFontIndex = index;
        const f = INTRO_FONTS[index];
        elIntroWord.textContent = 'Infinitas';
        elIntroWord.style.fontFamily = f.family;
        elIntroWord.style.fontWeight = f.weight;
        elIntroWord.style.fontStyle = f.style;
        elIntroWord.style.letterSpacing = f.tracking;
        elIntroWord.style.fontSize = 'calc(clamp(2.5rem, 7.6vw, 5.1rem) * ' + f.scale + ')';
      }

      // Curva suave con desaceleración precisa al llegar al título
      function easeOutQuint(t) {
        return 1 - Math.pow(1 - t, 4);
      }

      // Animación continua de los reflejos del metal líquido azul sobre las curvas de "Infinitas"
      function updateLiquidBlueMetal(nowMs) {
        const t = nowMs * 0.0014;
        const root = document.documentElement;

        // Movimiento continuo orgánico de las zonas de luz celeste y azul profundo
        const x1 = 28 + Math.sin(t * 1.3) * 22 + Math.cos(t * 0.7) * 10;
        const y1 = 35 + Math.cos(t * 1.1) * 24;
        const x2 = 72 + Math.cos(t * 1.45) * 22 - Math.sin(t * 0.8) * 10;
        const y2 = 62 + Math.sin(t * 1.25) * 24;
        const x3 = 50 + Math.sin(t * 1.85 + 1.2) * 28;
        const y3 = 26 + Math.cos(t * 1.55 + 0.6) * 22;
        const x4 = 22 + Math.cos(t * 0.95 + 2.0) * 18;
        const y4 = 72 + Math.sin(t * 1.15 + 1.4) * 18;
        const x5 = 80 + Math.sin(t * 1.6 + 0.4) * 18;
        const y5 = 30 + Math.cos(t * 1.35 + 2.1) * 22;

        root.style.setProperty('--m-x1', x1.toFixed(1) + '%');
        root.style.setProperty('--m-y1', y1.toFixed(1) + '%');
        root.style.setProperty('--m-x2', x2.toFixed(1) + '%');
        root.style.setProperty('--m-y2', y2.toFixed(1) + '%');
        root.style.setProperty('--m-x3', x3.toFixed(1) + '%');
        root.style.setProperty('--m-y3', y3.toFixed(1) + '%');
        root.style.setProperty('--m-x4', x4.toFixed(1) + '%');
        root.style.setProperty('--m-y4', y4.toFixed(1) + '%');
        root.style.setProperty('--m-x5', x5.toFixed(1) + '%');
        root.style.setProperty('--m-y5', y5.toFixed(1) + '%');

        // Actualizar posición 3D de las luces sobre el relieve de cada letra (curvas, trazos verticales y serifas)
        if (elLightSpec1 && elLightSpec2 && elLightDiffuse) {
          const lx1 = 150 + Math.sin(t * 1.5) * 130;
          const ly1 = 42 + Math.cos(t * 1.2) * 34;
          const lz1 = 64 + Math.sin(t * 0.9) * 18;

          const lx2 = 160 + Math.cos(t * 1.75 + 1.1) * 140;
          const ly2 = 52 + Math.sin(t * 1.4 + 0.7) * 36;
          const lz2 = 50 + Math.cos(t * 1.1) * 14;

          const lxd = 150 + Math.sin(t * 0.85) * 90;
          const lyd = 36 + Math.cos(t * 0.75) * 28;

          elLightSpec1.setAttribute('x', lx1.toFixed(1));
          elLightSpec1.setAttribute('y', ly1.toFixed(1));
          elLightSpec1.setAttribute('z', lz1.toFixed(1));

          elLightSpec2.setAttribute('x', lx2.toFixed(1));
          elLightSpec2.setAttribute('y', ly2.toFixed(1));
          elLightSpec2.setAttribute('z', lz2.toFixed(1));

          elLightDiffuse.setAttribute('x', lxd.toFixed(1));
          elLightDiffuse.setAttribute('y', lyd.toFixed(1));
        }
      }

      function finishIntroImmediately() {
        document.querySelectorAll('header, main, footer').forEach(node => { node.inert = false; node.removeAttribute('inert'); });
        sequenceCompleted = true;
        document.body.classList.remove('intro-locked');
        document.body.classList.add('portfolio-revealed');
        elHeroAura.classList.add('aura-visible');
        elHeroSlot.classList.add('slot-visible');
        elCurtain.classList.add('curtain-hidden');
        elStage.style.display = 'none';
        elCurtain.style.display = 'none';
      }

      function startExperience() {
        if (prefersReducedMotion) {
          finishIntroImmediately();
          return;
        }

        // Asegurar que la página comience arriba del todo durante la entrada
        try {
          window.scrollTo(0, 0);
        } catch (e) {}

        applyIntroFont(0);
        const startWallTime = Date.now();

        function tick() {
          const nowWall = Date.now();
          const elapsed = nowWall - startWallTime;

          // Actualizar siempre los reflejos del acabado metálico cuando ya está activo
          if (metallicActivated || sequenceCompleted) {
            updateLiquidBlueMetal(nowWall);
          }

          if (!sequenceCompleted) {
            // Fase A: Secuencia de 21 tipografías (0ms -> TIME_ALL_FONTS_DONE)
            if (elapsed < TIME_ALL_FONTS_DONE) {
              let targetIdx = 0;
              for (let i = fontChangeTimestamps.length - 1; i >= 0; i--) {
                if (elapsed >= fontChangeTimestamps[i]) {
                  targetIdx = i;
                  break;
                }
              }
              applyIntroFont(targetIdx);
            } else {
              // Asegurar tipografía final #21: Averia Serif Libre en cursiva
              applyIntroFont(INTRO_FONTS.length - 1);

              // Activar el acabado metálico azul pulido sobre la palabra centrada
              if (!metallicActivated) {
                metallicActivated = true;
                elIntroWord.classList.add('infinitas-metallic');
              }
            }

            // Revelar el aura azul superior poco antes del desplazamiento
            if (elapsed >= TIME_AURA_START && !auraActivated) {
              auraActivated = true;
              elHeroAura.classList.add('aura-visible');
            }

            // Fase B: Desplazamiento desde el centro hasta su posición dentro del título principal
            if (elapsed >= TIME_FLIGHT_START && elapsed < TIME_SEQUENCE_END) {
              if (!revealTriggered) {
                revealTriggered = true;
                elCurtain.classList.add('curtain-hidden');
                document.body.classList.add('portfolio-revealed');
                document.body.classList.remove('intro-locked');
              }

              const rawProgress = Math.min(1, Math.max(0, (elapsed - TIME_FLIGHT_START) / FLIGHT_DURATION_MS));
              const eased = easeOutQuint(rawProgress);

              // Medir la posición exacta del slot destino dentro del H1 en cada fotograma
              const slotRect = elHeroSlot.getBoundingClientRect();
              const slotCenterX = slotRect.left + slotRect.width / 2;
              const slotCenterY = slotRect.top + slotRect.height / 2;

              const startCenterX = window.innerWidth / 2;
              const startCenterY = window.innerHeight / 2;

              // Tamaño inicial vs tamaño final del título
              const computedSlotStyle = window.getComputedStyle(elHeroSlot);
              const targetFontSize = parseFloat(computedSlotStyle.fontSize) || 48;
              const baseIntroFontSize = parseFloat(window.getComputedStyle(elIntroWord).fontSize) || 64;
              const targetScale = targetFontSize / baseIntroFontSize;

              const currentX = startCenterX + (slotCenterX - startCenterX) * eased;
              const currentY = startCenterY + (slotCenterY - startCenterY) * eased;
              const currentScale = 1 + (targetScale - 1) * eased;

              elWrapper.style.left = currentX + 'px';
              elWrapper.style.top = currentY + 'px';
              elWrapper.style.transform = 'translate3d(-50%, -50%, 0) scale(' + currentScale.toFixed(4) + ')';
            } else if (elapsed >= TIME_SEQUENCE_END) {
              // Fase C: La palabra ya llegó exactamente a su lugar en el título;
              // hacer visible el slot único del título y ocultar el elemento de vuelo en el mismo fotograma
              finishIntroImmediately();
            }
          }

          if (!document.hidden && !disposed) animationFrame = requestAnimationFrame(tick);
        }

        if (!document.hidden && !disposed) animationFrame = requestAnimationFrame(tick);

        // Si el visitante cambia de pestaña durante la entrada y regresa después,
        // sincronizar al instante para que el contenido nunca quede bloqueado
        document.addEventListener('visibilitychange', function () {
          if (document.hidden) {
            cancelAnimationFrame(animationFrame);
            if (!sequenceCompleted) { metallicActivated = true; finishIntroImmediately(); }
          } else if (!disposed) {
            cancelAnimationFrame(animationFrame);
            animationFrame = requestAnimationFrame(tick);
          }
        });
        window.addEventListener('pagehide', function () {
          disposed = true; cancelAnimationFrame(animationFrame); finishIntroImmediately();
        }, { once: true });
      }

      // ===================================================================
      // 2. DATOS Y LÓGICA DEL ASISTENTE DE SOLICITUD DE SERVICIO
      // ===================================================================
      const SERVICES_META = {
        bots: {
          id: 'bots',
          name: 'Bots de Discord',
          description: 'Automatización, moderación, herramientas para comunidades e integraciones.'
        },
        web: {
          id: 'web',
          name: 'Páginas Web',
          description: 'Páginas profesionales, paneles de gestión y aplicaciones adaptadas a las necesidades del cliente.'
        },
        sistemas: {
          id: 'sistemas',
          name: 'Sistemas Personalizados',
          description: 'Software, herramientas y automatizaciones a medida.'
        }
      };

      const BOT_CATEGORIES = [
        {
          id: 'personalizado',
          name: 'Bot personalizado',
          shortLabel: 'Personalizado',
          description: 'Comandos, integraciones externas, almacenamiento y registros avanzados.',
          features: [
            'Comandos personalizados',
            'Integración con servicios externos',
            'Almacenamiento de información',
            'Registros avanzados'
          ]
        },
        {
          id: 'rol',
          name: 'Servidor de rol',
          shortLabel: 'Servidor de rol',
          description: 'Aperturas, multas y arrestos, economía, sanciones, documentos y licencias.',
          features: [
            'Aperturas de servidor',
            'Multas y arrestos',
            'Economía',
            'Sanciones',
            'Documentos de identidad y licencias'
          ]
        },
        {
          id: 'economia',
          name: 'Economía',
          shortLabel: 'Economía',
          description: 'Recompensas periódicas, ingresos por roles, banco y juegos de casino.',
          features: [
            'Recompensas periódicas',
            'Ingresos por roles',
            'Banco',
            'Juegos de casino'
          ]
        },
        {
          id: 'multifuncional',
          name: 'Multifuncional',
          shortLabel: 'Multifuncional',
          description: 'Tickets, moderación, protección básica, encuestas y sorteos.',
          features: [
            'Tickets',
            'Moderación',
            'Protección básica',
            'Encuestas',
            'Sorteos'
          ]
        },
        {
          id: 'proteccion',
          name: 'Protección contra ataques y abuso',
          shortLabel: 'Protección',
          description: 'Control de bots no verificados, asignación de roles, supervisión y medidas configurables.',
          features: [
            'Control de bots no verificados',
            'Asignación de roles',
            'Supervisión',
            'Medidas configurables'
          ]
        }
      ];

      const wizardState = {
        service: 'bots',
        stepIndex: 0,
        botCategory: 'personalizado',
        botFeaturesByCategory: {
          personalizado: ['Comandos personalizados'],
          rol: ['Aperturas de servidor'],
          economia: ['Banco'],
          multifuncional: ['Tickets', 'Moderación'],
          proteccion: ['Control de bots no verificados']
        },
        projectDescriptionByService: {
          web: '',
          sistemas: ''
        },
        clientName: '',
        communityName: '',
        extraDetails: ''
      };

      function getFlowSteps(service) {
        if (service === 'bots') {
          return [
            { key: 'service', title: 'Servicio' },
            { key: 'bot-category', title: 'Categoría' },
            { key: 'bot-features', title: 'Funciones' },
            { key: 'details', title: 'Detalles' },
            { key: 'summary', title: 'Resumen' }
          ];
        }
        return [
          { key: 'service', title: 'Servicio' },
          { key: 'project-desc', title: 'Descripción' },
          { key: 'details', title: 'Detalles' },
          { key: 'summary', title: 'Resumen' }
        ];
      }

      const elServiceBadge = document.getElementById('wizard-service-badge');
      const elStepCounter = document.getElementById('wizard-step-counter');
      const elProgressBar = document.getElementById('wizard-progress-bar');
      const elStepperList = document.getElementById('wizard-stepper-list');
      const elFeedback = document.getElementById('wizard-feedback');
      const elFeedbackText = document.getElementById('wizard-feedback-text');
      const elFeedbackClose = document.getElementById('wizard-feedback-close');

      const panels = {
        'service': document.getElementById('wizard-panel-service'),
        'bot-category': document.getElementById('wizard-panel-bot-category'),
        'bot-features': document.getElementById('wizard-panel-bot-features'),
        'project-desc': document.getElementById('wizard-panel-project-desc'),
        'details': document.getElementById('wizard-panel-details'),
        'summary': document.getElementById('wizard-panel-summary')
      };

      const elBotCategoryGrid = document.getElementById('bot-category-grid');
      const elCurrentBotCatTitle = document.getElementById('current-bot-cat-title');
      const elBotFeaturesGrid = document.getElementById('bot-features-grid');
      const elBtnSelectAllFeatures = document.getElementById('btn-select-all-features');

      const elProjectDescHeading = document.getElementById('project-desc-heading');
      const elProjectDescSubtext = document.getElementById('project-desc-subtext');
      const elInputProjectDesc = document.getElementById('input-project-description');
      const elInputClientName = document.getElementById('input-client-name');
      const elInputCommunityName = document.getElementById('input-community-name');
      const elInputExtraDetails = document.getElementById('input-extra-details');

      const elSummaryDl = document.getElementById('summary-dl-list');
      const elSummaryPreview = document.getElementById('summary-text-preview');
      const elBtnCopySummary = document.getElementById('btn-copy-summary');
      const elCopySummaryLabel = document.getElementById('copy-summary-label');
      const elCopyToastBadge = document.getElementById('copy-toast-badge');

      const elBtnPrev = document.getElementById('wizard-btn-prev');
      const elBtnNext = document.getElementById('wizard-btn-next');
      const elBtnNextLabel = document.getElementById('wizard-btn-next-label');
      const elBtnDiscordFinal = document.getElementById('wizard-btn-discord-final');

      function showFeedback(msg) {
        elFeedbackText.textContent = msg;
        elFeedback.classList.remove('hidden');
      }

      function hideFeedback() {
        elFeedback.classList.add('hidden');
      }

      elFeedbackClose.addEventListener('click', hideFeedback);

      elInputProjectDesc.addEventListener('input', function (e) {
        if (wizardState.service === 'web' || wizardState.service === 'sistemas') {
          wizardState.projectDescriptionByService[wizardState.service] = e.target.value;
        }
      });

      elInputClientName.addEventListener('input', function (e) {
        wizardState.clientName = e.target.value;
      });

      elInputCommunityName.addEventListener('input', function (e) {
        wizardState.communityName = e.target.value;
      });

      elInputExtraDetails.addEventListener('input', function (e) {
        wizardState.extraDetails = e.target.value;
      });

      function renderServiceCards() {
        const buttons = document.querySelectorAll('[data-select-service]');
        buttons.forEach(function (btn) {
          const svc = btn.getAttribute('data-select-service');
          const active = svc === wizardState.service;
          btn.setAttribute('aria-checked', active ? 'true' : 'false');
          btn.className = active
            ? 'wizard-service-card text-left p-5 rounded-xl border border-white bg-white/[0.06] transition-all flex flex-col justify-between gap-4'
            : 'wizard-service-card text-left p-5 rounded-xl border border-white/10 bg-[#050608] hover:border-white/25 transition-all flex flex-col justify-between gap-4';
        });
      }

      function renderBotCategories() {
        elBotCategoryGrid.innerHTML = '';
        BOT_CATEGORIES.forEach(function (cat) {
          const active = cat.id === wizardState.botCategory;
          const selectedCount = (wizardState.botFeaturesByCategory[cat.id] || []).length;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('role', 'radio');
          btn.setAttribute('aria-checked', active ? 'true' : 'false');
          btn.className = active
            ? 'text-left p-4 rounded-xl border border-white bg-white/[0.06] transition-all flex flex-col justify-between gap-3'
            : 'text-left p-4 rounded-xl border border-white/10 bg-[#050608] hover:border-white/25 transition-all flex flex-col justify-between gap-3';

          btn.innerHTML =
            '<div class="space-y-1.5">' +
              '<div class="flex items-center justify-between gap-2">' +
                '<span class="font-medium text-sm sm:text-base text-white">' + cat.name + '</span>' +
                '<span class="w-4 h-4 rounded-full border flex items-center justify-center text-[10px] ' +
                  (active ? 'border-white bg-white text-black' : 'border-zinc-600') + '">' +
                  (active ? '✓' : '') +
                '</span>' +
              '</div>' +
              '<p class="text-xs text-zinc-400 leading-relaxed">' + cat.description + '</p>' +
            '</div>' +
            '<div class="flex items-center justify-between pt-2 border-t border-white/[0.07] text-[11px] text-zinc-500">' +
              '<span>' + cat.features.length + ' funciones</span>' +
              '<span class="text-zinc-300">' + selectedCount + ' seleccionada(s)</span>' +
            '</div>';

          btn.addEventListener('click', function () {
            wizardState.botCategory = cat.id;
            hideFeedback();
            renderBotCategories();
          });
          elBotCategoryGrid.appendChild(btn);
        });
      }

      function renderBotFeatures() {
        const catObj = BOT_CATEGORIES.find(function (c) { return c.id === wizardState.botCategory; }) || BOT_CATEGORIES[0];
        elCurrentBotCatTitle.textContent = catObj.name;
        const currentSelected = wizardState.botFeaturesByCategory[catObj.id] || [];

        elBotFeaturesGrid.innerHTML = '';
        catObj.features.forEach(function (featName) {
          const checked = currentSelected.indexOf(featName) !== -1;
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.setAttribute('aria-pressed', checked ? 'true' : 'false');
          btn.className = checked
            ? 'text-left p-4 rounded-xl border border-white bg-white/[0.06] flex items-center justify-between gap-3 transition-all'
            : 'text-left p-4 rounded-xl border border-white/10 bg-[#050608] hover:border-white/25 flex items-center justify-between gap-3 transition-all';

          btn.innerHTML =
            '<div class="flex items-center gap-3">' +
              '<span class="w-4 h-4 rounded border flex items-center justify-center shrink-0 text-[10px] ' +
                (checked ? 'bg-white border-white text-black font-bold' : 'border-zinc-600 bg-transparent') + '">' +
                (checked ? '✓' : '') +
              '</span>' +
              '<span class="text-sm font-medium text-white">' + featName + '</span>' +
            '</div>' +
            '<span class="text-[11px] ' + (checked ? 'text-zinc-200' : 'text-zinc-500') + '">' +
              (checked ? 'Incluida' : 'Opcional') +
            '</span>';

          btn.addEventListener('click', function () {
            const list = wizardState.botFeaturesByCategory[catObj.id] || [];
            const idx = list.indexOf(featName);
            if (idx === -1) {
              list.push(featName);
            } else {
              list.splice(idx, 1);
            }
            wizardState.botFeaturesByCategory[catObj.id] = list;
            hideFeedback();
            renderBotFeatures();
          });

          elBotFeaturesGrid.appendChild(btn);
        });

        const allSelected = currentSelected.length === catObj.features.length;
        elBtnSelectAllFeatures.textContent = allSelected ? 'Desmarcar todas' : 'Seleccionar todas';
      }

      elBtnSelectAllFeatures.addEventListener('click', function () {
        const catObj = BOT_CATEGORIES.find(function (c) { return c.id === wizardState.botCategory; }) || BOT_CATEGORIES[0];
        const currentSelected = wizardState.botFeaturesByCategory[catObj.id] || [];
        if (currentSelected.length === catObj.features.length) {
          wizardState.botFeaturesByCategory[catObj.id] = [];
        } else {
          wizardState.botFeaturesByCategory[catObj.id] = catObj.features.slice();
        }
        renderBotFeatures();
      });

      function buildSummaryText() {
        const svcMeta = SERVICES_META[wizardState.service];
        const lines = [];
        lines.push('=== SOLICITUD DE SERVICIO — INFINITEDEV (By Adamsitoo) ===');
        lines.push('• Servicio: ' + svcMeta.name);

        if (wizardState.service === 'bots') {
          const catObj = BOT_CATEGORIES.find(function (c) { return c.id === wizardState.botCategory; }) || BOT_CATEGORIES[0];
          const feats = wizardState.botFeaturesByCategory[catObj.id] || [];
          lines.push('• Categoría del Bot: ' + catObj.name);
          lines.push('• Funciones seleccionadas: ' + (feats.length > 0 ? feats.join(', ') : 'Por definir en Discord'));
        } else {
          const desc = (wizardState.projectDescriptionByService[wizardState.service] || '').trim();
          lines.push('• Descripción del proyecto: ' + (desc || 'Por detallar en Discord'));
        }

        if (wizardState.clientName.trim()) {
          lines.push('• Contacto / Usuario: ' + wizardState.clientName.trim());
        }
        if (wizardState.communityName.trim()) {
          lines.push('• Comunidad / Proyecto: ' + wizardState.communityName.trim());
        }
        lines.push('• Detalles, necesidades y dudas: ' + (wizardState.extraDetails.trim() || 'Ninguno especificado'));
        return lines.join('\n');
      }

      function escapeHtml(str) {
        return String(str)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;');
      }

      function renderSummaryStep() {
        const svcMeta = SERVICES_META[wizardState.service];
        const rows = [];

        rows.push({
          label: 'Servicio seleccionado',
          value: svcMeta.name,
          stepIndex: 0
        });

        if (wizardState.service === 'bots') {
          const catObj = BOT_CATEGORIES.find(function (c) { return c.id === wizardState.botCategory; }) || BOT_CATEGORIES[0];
          const feats = wizardState.botFeaturesByCategory[catObj.id] || [];
          rows.push({
            label: 'Categoría del Bot',
            value: catObj.name,
            stepIndex: 1
          });
          rows.push({
            label: 'Funciones (' + catObj.shortLabel + ')',
            value: feats.length > 0 ? feats.join(', ') : 'Ninguna función seleccionada',
            stepIndex: 2
          });
          rows.push({
            label: 'Detalles, necesidades y dudas',
            value: wizardState.extraDetails.trim() || 'Sin detalles adicionales',
            stepIndex: 3
          });
        } else {
          const desc = (wizardState.projectDescriptionByService[wizardState.service] || '').trim();
          rows.push({
            label: 'Descripción del proyecto',
            value: desc || 'Sin descripción introducida',
            stepIndex: 1
          });
          rows.push({
            label: 'Detalles, necesidades y dudas',
            value: wizardState.extraDetails.trim() || 'Sin detalles adicionales',
            stepIndex: 2
          });
        }

        if (wizardState.clientName.trim() || wizardState.communityName.trim()) {
          const ident = [wizardState.clientName.trim(), wizardState.communityName.trim()].filter(Boolean).join(' — ');
          rows.push({
            label: 'Identificación',
            value: ident,
            stepIndex: wizardState.service === 'bots' ? 3 : 2
          });
        }

        elSummaryDl.innerHTML = '';
        rows.forEach(function (r) {
          const div = document.createElement('div');
          div.className = 'py-3 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-2';
          div.innerHTML =
            '<div class="space-y-0.5">' +
              '<dt class="text-xs text-zinc-500">' + r.label + '</dt>' +
              '<dd class="text-sm font-medium text-white break-words">' + escapeHtml(r.value) + '</dd>' +
            '</div>' +
            '<button type="button" data-jump-step="' + r.stepIndex + '" class="self-start sm:self-center text-xs text-zinc-400 hover:text-white underline underline-offset-4 shrink-0">' +
              'Modificar paso' +
            '</button>';
          elSummaryDl.appendChild(div);
        });

        elSummaryDl.querySelectorAll('[data-jump-step]').forEach(function (b) {
          b.addEventListener('click', function () {
            wizardState.stepIndex = parseInt(b.getAttribute('data-jump-step'), 10);
            renderWizard();
          });
        });

        elSummaryPreview.textContent = buildSummaryText();
      }

      function renderWizard() {
        hideFeedback();
        const steps = getFlowSteps(wizardState.service);
        if (wizardState.stepIndex >= steps.length) {
          wizardState.stepIndex = steps.length - 1;
        }
        if (wizardState.stepIndex < 0) {
          wizardState.stepIndex = 0;
        }

        const currentStepObj = steps[wizardState.stepIndex];
        const totalSteps = steps.length;
        const pct = Math.round(((wizardState.stepIndex + 1) / totalSteps) * 100);

        elServiceBadge.textContent = 'Servicio: ' + SERVICES_META[wizardState.service].name;
        elStepCounter.textContent = 'Paso ' + (wizardState.stepIndex + 1) + ' de ' + totalSteps;
        elProgressBar.style.width = pct + '%';

        elStepperList.className = 'grid grid-cols-2 sm:grid-cols-' + totalSteps + ' gap-2 pt-1';
        elStepperList.innerHTML = '';
        steps.forEach(function (st, idx) {
          const isCurrent = idx === wizardState.stepIndex;
          const isDone = idx < wizardState.stepIndex;
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className =
            'w-full flex items-center gap-2 px-3 py-2 rounded-xl border text-left transition-all ' +
            (isCurrent
              ? 'border-white bg-white/[0.08] text-white'
              : isDone
              ? 'border-white/20 bg-white/[0.03] text-zinc-300 hover:border-white/40'
              : 'border-white/10 bg-transparent text-zinc-500 hover:text-zinc-300');

          btn.innerHTML =
            '<span class="w-5 h-5 rounded-full text-[11px] font-medium flex items-center justify-center shrink-0 ' +
              (isCurrent
                ? 'bg-white text-black'
                : isDone
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-zinc-500') + '">' +
              (isDone ? '✓' : (idx + 1)) +
            '</span>' +
            '<span class="text-xs font-medium truncate">' + st.title + '</span>';

          btn.addEventListener('click', function () {
            wizardState.stepIndex = idx;
            renderWizard();
          });

          li.appendChild(btn);
          elStepperList.appendChild(li);
        });

        Object.keys(panels).forEach(function (k) {
          if (k === currentStepObj.key) {
            panels[k].classList.remove('hidden');
          } else {
            panels[k].classList.add('hidden');
          }
        });

        if (currentStepObj.key === 'service') {
          renderServiceCards();
        } else if (currentStepObj.key === 'bot-category') {
          renderBotCategories();
        } else if (currentStepObj.key === 'bot-features') {
          renderBotFeatures();
        } else if (currentStepObj.key === 'project-desc') {
          const isWeb = wizardState.service === 'web';
          elProjectDescHeading.textContent = isWeb
            ? '2. Descripción de tu Página Web'
            : '2. Descripción de tu Sistema Personalizado';
          elProjectDescSubtext.textContent = isWeb
            ? 'Describe la página profesional, panel de gestión o aplicación adaptada que necesitas.'
            : 'Describe el software, herramienta o automatización a medida que necesitas.';
          elInputProjectDesc.value = wizardState.projectDescriptionByService[wizardState.service] || '';
        } else if (currentStepObj.key === 'details') {
          const stepNum = wizardState.stepIndex + 1;
          document.getElementById('details-step-heading').textContent =
            stepNum + '. Detalles, necesidades y dudas';
          elInputClientName.value = wizardState.clientName;
          elInputCommunityName.value = wizardState.communityName;
          elInputExtraDetails.value = wizardState.extraDetails;
        } else if (currentStepObj.key === 'summary') {
          renderSummaryStep();
        }

        elBtnPrev.disabled = wizardState.stepIndex === 0;
        const isLastStep = wizardState.stepIndex === totalSteps - 1;
        if (isLastStep) {
          elBtnNext.classList.add('hidden');
          elBtnDiscordFinal.classList.remove('hidden');
          elBtnDiscordFinal.classList.add('inline-flex');
        } else {
          elBtnNext.classList.remove('hidden');
          elBtnDiscordFinal.classList.add('hidden');
          elBtnDiscordFinal.classList.remove('inline-flex');
          elBtnNextLabel.textContent =
            wizardState.stepIndex === totalSteps - 2 ? 'Ver resumen de solicitud' : 'Siguiente paso';
        }
      }

      document.querySelectorAll('[data-select-service]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          wizardState.service = btn.getAttribute('data-select-service');
          renderServiceCards();
          elServiceBadge.textContent = 'Servicio: ' + SERVICES_META[wizardState.service].name;
        });
      });

      elBtnPrev.addEventListener('click', function () {
        if (wizardState.stepIndex > 0) {
          wizardState.stepIndex -= 1;
          renderWizard();
        }
      });

      elBtnNext.addEventListener('click', function () {
        const steps = getFlowSteps(wizardState.service);
        const currentKey = steps[wizardState.stepIndex].key;

        if (currentKey === 'bot-features') {
          const feats = wizardState.botFeaturesByCategory[wizardState.botCategory] || [];
          if (feats.length === 0) {
            showFeedback('Selecciona al menos una función para continuar.');
            return;
          }
        }
        if (currentKey === 'project-desc') {
          const desc = (wizardState.projectDescriptionByService[wizardState.service] || '').trim();
          if (!desc) {
            showFeedback('Escribe una descripción del proyecto para continuar al siguiente paso.');
            elInputProjectDesc.focus();
            return;
          }
        }

        if (wizardState.stepIndex < steps.length - 1) {
          wizardState.stepIndex += 1;
          renderWizard();
        }
      });

      elBtnCopySummary.addEventListener('click', function () {
        const text = buildSummaryText();
        function showCopiedToast() {
          elCopySummaryLabel.textContent = 'Resumen copiado';
          elCopyToastBadge.classList.remove('hidden');
          setTimeout(function () {
            elCopySummaryLabel.textContent = 'Copiar resumen para Discord';
            elCopyToastBadge.classList.add('hidden');
          }, 3000);
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(showCopiedToast).catch(function () {
            fallbackCopy(text);
            showCopiedToast();
          });
        } else {
          fallbackCopy(text);
          showCopiedToast();
        }
      });

      function fallbackCopy(text) {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
        } catch (err) {}
        document.body.removeChild(ta);
      }

      function openWizardWithService(serviceKey, advanceToStep2) {
        if (serviceKey && SERVICES_META[serviceKey]) {
          wizardState.service = serviceKey;
          wizardState.stepIndex = advanceToStep2 ? 1 : 0;
        }
        renderWizard();
        const section = document.getElementById('encargar');
        if (section) {
          section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }

      ['nav-btn-encargar', 'mobile-quick-encargar', 'hero-btn-encargar', 'services-header-encargar'].forEach(function (id) {
        const btn = document.getElementById(id);
        if (btn) {
          btn.addEventListener('click', function () {
            openWizardWithService(null, false);
          });
        }
      });

      document.querySelectorAll('[data-service-start]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const svc = btn.getAttribute('data-service-start');
          openWizardWithService(svc, true);
        });
      });

      // Menú móvil
      const mobileToggle = document.getElementById('mobile-menu-toggle');
      const mobilePanel = document.getElementById('mobile-menu-panel');
      const iconOpen = document.getElementById('icon-menu-open');
      const iconClose = document.getElementById('icon-menu-close');

      function closeMobileMenu() {
        mobilePanel.classList.add('hidden');
        mobileToggle.setAttribute('aria-expanded', 'false');
        iconOpen.classList.remove('hidden');
        iconClose.classList.add('hidden');
      }

      mobileToggle.addEventListener('click', function () {
        const isHidden = mobilePanel.classList.contains('hidden');
        if (isHidden) {
          mobilePanel.classList.remove('hidden');
          mobileToggle.setAttribute('aria-expanded', 'true');
          iconOpen.classList.add('hidden');
          iconClose.classList.remove('hidden');
        } else {
          closeMobileMenu();
        }
      });

      document.querySelectorAll('.mobile-nav-link').forEach(function (link) {
        link.addEventListener('click', closeMobileMenu);
      });

      document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape') {
          document.querySelectorAll('.products-menu').forEach(menu => { menu.open = false; });
          if (mobileToggle.getAttribute('aria-expanded') === 'true') { closeMobileMenu(); mobileToggle.focus(); }
        }
      });
      document.addEventListener('click', function (event) {
        document.querySelectorAll('.products-menu').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
      });

      // Pestañas de información legal
      let activeLegalTab = 'privacidad';
      function setLegalTab(tabKey) {
        activeLegalTab = tabKey;
        document.querySelectorAll('[data-legal-tab]').forEach(function (btn) {
          const k = btn.getAttribute('data-legal-tab');
          const active = k === activeLegalTab;
          btn.setAttribute('aria-selected', active ? 'true' : 'false');
          btn.className = active
            ? 'legal-tab-btn px-4 py-2 rounded-full text-xs font-medium border border-white bg-white text-black transition-colors'
            : 'legal-tab-btn px-4 py-2 rounded-full text-xs font-medium border border-white/10 bg-[#0A0B0E] text-zinc-400 hover:text-white transition-colors';
        });

        ['privacidad', 'terminos', 'cookies', 'derechos'].forEach(function (k) {
          const panel = document.getElementById('legal-panel-' + k);
          if (panel) {
            if (k === activeLegalTab) {
              panel.classList.remove('hidden');
            } else {
              panel.classList.add('hidden');
            }
          }
        });
      }

      document.querySelectorAll('[data-legal-tab]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          setLegalTab(btn.getAttribute('data-legal-tab'));
        });
      });

      document.querySelectorAll('[data-footer-legal]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          const tab = btn.getAttribute('data-footer-legal');
          setLegalTab(tab);
          const legalSection = document.getElementById('legal');
          if (legalSection) {
            legalSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        });
      });

      // Inicializar asistente, pestañas legales y secuencia de entrada
      renderWizard();
      setLegalTab('privacidad');
      if (prefersReducedMotion || !document.fonts) startExperience();
      else Promise.allSettled(INTRO_FONTS.map(f => document.fonts.load(f.style + ' ' + f.weight + ' 64px ' + f.family))).then(() => { if (!disposed) startExperience(); });
    })();
