# Cursor Office Visualizer — Brief de direção UI/UX

**Tipo:** pesquisa de produto / design (não implementação)  
**Data:** 2026-09-29  
**Escopo:** uma skin MVP, um adapter Cursor, viewer-only, macOS  
**Fontes de produto:** `README.md`, plano `docs/plans/2026-09-28-001-feat-cursor-office-visualizer-plan.md`, domínio (`lifecycle.ts`, `events.ts`), renderer (`scene.ts`, `projection.ts`, `consultant-view.ts`, `ambient-director.ts`, `assets.ts`, `App.tsx`, `ObservationStatus.tsx`)

---

## Resumo executivo

O Office é um **display periférico de presença observada**, não um jogo nem um cliente de chat. A direção visual deve maximizar *glanceability* (leitura em <1s no canto do olho) e preservar a autoridade de verdade do produto: **observado > inferido > ambient**. O MVP atual já tem a gramática mínima (badge de proveniência, label `Consultant · XXXX`, hue estável, alpha para stale, ambient só em idle observado). A arte precisa elevar isso para um escritório top-down aconchegante **original**, sem trade dress de Stardew Valley, sem inventar trabalho, e com fallback acessível.

**Recomendação de direção:** conceito **C — “Atelier Norte / Harbor Desk”** (luz fria do Norte, madeira clara, azul-ardósia, tipografia serif editorial já presente no shell).

---

## Fontes de pesquisa (URLs)

### Ambient / peripheral / calm

- Weiser & Brown — *The Coming Age of Calm Technology*: https://calmtech.com/papers/coming-age-of-calm-technology  
- Weiser & Brown (PDF espelho MIT): https://people.csail.mit.edu/rudolph/Teaching/weiser.pdf  
- Matthews, Forlizzi, Rohrbach — *Designing Glanceable Peripheral Displays* (UCB/EECS-2006-113): https://www2.eecs.berkeley.edu/Pubs/TechRpts/2006/EECS-2006-113.html · PDF: https://www2.eecs.berkeley.edu/Pubs/TechRpts/2006/Archive/EECS-2006-113.pdf  
- Matthews et al. — *Defining, Designing, and Evaluating Peripheral Displays* (Activity Theory): http://www.madpickle.net/scott/pubs/hcij07-peripheral-display-eval.pdf  
- CHI 2025 — *Sensing Noticeability in Ambient Information Environments*: https://dl.acm.org/doi/10.1145/3706598.3713511  
- SIGGRAPH Asia 2025 — *Komorebi-Mediated Ambient Notifications for Calm Technology*: https://dl.acm.org/doi/10.1145/3757374.3771454  
- Amber Case / princípios Calm Tech (síntese Adobe): https://blog.adobe.com/en/publish/2016/10/12/calm-technology-in-the-era-of-experience-design  

### Pixel art / escala / câmera

- SLYNYRD — Top-down character sprites: https://www.slynyrd.com/blog/2019/10/21/pixelblog-22-top-down-character-sprites  
- Stuart’s Pixel Games — sprite & world sizing: https://stuartspixelgames.com/2022/05/25/how-to-work-out-size-of-sprites-game-world/  
- Screwloose Games — Pixel Art Guide: https://screwloose-games.github.io/documentation/content/guides/art/pixel_art/pixel_art_guide.html  
- Unity 2D Pixel Perfect: https://docs.unity3d.com/Packages/com.unity.2d.pixel-perfect@5.0/manual/index.html  

### Presence / status UX

- Presence UX Pattern: https://uxpatternsguide.com/patterns/presence/  
- Status Dot (NameThatUI): https://namethatui.com/web/status-dot  
- Gather — Status & Availability: https://support.help.gather.town/articles/9785009882-status-availability  

### Acessibilidade

- WCAG 2.2: https://www.w3.org/TR/WCAG22/  
- WCAG 1.4.1 Use of Color: https://www.w3.org/WAI/WCAG21/Understanding/use-of-color.html  
- WCAG 1.4.11 Non-text Contrast: https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast  
- Preferência de movimento reduzido (MDN): https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion  

### macOS / shell

- Apple HIG — Windows: https://developer.apple.com/design/human-interface-guidelines/windows  
- Apple HIG — Panels (padrão flutuante/HUD): documentação Apple Developer “Panels”  
- Electron security (já no plano): https://www.electronjs.org/docs/latest/tutorial/security  
- PixiJS 8 Application: https://pixijs.com/8.x/guides/components/application  

### Produto / adapter

- Cursor Hooks: https://cursor.com/docs/hooks  

---

## 1. Persona e contexto de uso

### Persona primária — “Operador de agentes”

Consultor/engenheiro sênior com **várias conversas Cursor** (IDE + CLI) abertas ao longo do dia: agentes persistentes (mesmo `conversation_id` por horas) e ephemeral (subagents, bursts). Trabalha em pressão de entrega; Cursor é a ferramenta primária; Office é o **segundo monitor de atenção periférica**.

### Contexto

| Dimensão | Realidade do MVP |
| --- | --- |
| Dispositivo | macOS desktop, janela Electron ~1280×800 (mín. 900×600) |
| Postura | Viewer-only; nunca envia prompts/aprovações |
| Atenção | Primária em Cursor; Office no canto / segundo display |
| Pergunta de 1s | “Alguém está trabalhando? Alguém está parado? Algo está stale? Estou desconectado?” |
| Privacidade | Sem prompts, arquivos, I/O de tools; só ids/lease/labels estáveis |
| Lacunas honestas | App fechado ≠ idle; silêncio ≠ idle; Cloud Agents fora de escopo |

### Jobs-to-be-done

1. Saber, sem abrir o chat, se há trabalho **observado** agora.  
2. Distinguir idle real (stop observado) de liveness **inferida**/stale (restart sem stop).  
3. Ver colaboradores temporários sem confundir com o consultor pai.  
4. Confiar que animação “divertida” **não** estende lease nem finge trabalho.  
5. Instalar/remover observer e entender saúde da observação.

---

## 2. Princípios de design (máx. 6)

1. **Verdade antes de charme.** Observado > inferido > ambient. Se a cena ficar mais “viva” do que a evidência, o design falhou.  
2. **Glanceable, não jogável.** Um olhar deve responder: quantos, quem, que estado, se o observer está vivo. Sem HUD denso, sem stats, sem quests.  
3. **Proveniência visível.** Badge/forma/texto devem distinguir observed / inferred / ambient / stale — nunca só cor.  
4. **Ambient é recreação, não retenção.** Ping-pong, pool, cartas, bola, plantio: só em idle observado; interrompidos por qualquer trabalho; nunca refresh de lease.  
5. **Identidade sem conteúdo.** Labels `Consultant · XXXX` + hue estável derivados de identity; archetypes são skins, não semântica do bot.  
6. **Calma no desktop.** Pouca captura de atenção; motion só onde carrega significado; reduced-motion e VoiceOver são cidadãos de primeira classe.

---

## 3. Hierarquia de informação e shell layout

### Hierarquia (do mais ao menos crítico)

1. **Saúde do observer** (disconnected / waiting / observed / ambient / stale)  
2. **Contagem e estados dos consultores** (active / idle / stale)  
3. **Colaboradores** (presença temporária perto do pai)  
4. **Identidade local** (label + accent)  
5. **Atmosfera do mapa** (zonas, props, luz)  
6. **Chrome de produto** (Integration, version meta)

### Shell proposto (evolução do atual)

```
┌─────────────────────────────────────────────────────────┐
│  Cursor Office                    [Integration]         │
│  Viewer-only local observation                          │
│  ┌ status-strip: STATUS · detail (aria-live=polite) ┐  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│              PIXI OFFICE STAGE (full bleed)             │
│   floor + zones + desks + NPCs + ambient props          │
│                                                         │
│  waiting cue (só se connected && 0 consultants)         │
│  vX.Y · darwin · viewer-only                            │
└─────────────────────────────────────────────────────────┘
```

**Regras de shell**

- Office = view primária full-window (já no plano U5).  
- Status strip **sempre** legível; texto > ícone.  
- Onboarding (`ConnectCursor`) overlay modal sobre o stage vazio — não compete com NPCs reais.  
- Settings (`⌘,`) modal; não navegação multi-página.  
- Meta de versão discreta; sem cards no hero/stage.  
- Janela macOS: app window normal (não HUD compulsório no MVP). Preferências futuras: “Keep visible while working” (floating) — **opt-in**, nunca default roubar foco (alinhado a HIG panels / nonactivating patterns).

---

## 4. Proposta de zoning / mapa

Uma planta top-down **única**, legível em 900×600 e 1280×800+. Grid lógico 16px; mapa ~40×24 tiles (~640×384 world px) com integer scale (×2/×3) no viewport.

### Zonas

| Zona | Função | Quem entra | Semântica |
| --- | --- | --- | --- |
| **A. Floor de trabalho** | Mesas em fila ou L | Consultores active/stale sentados; idle podem levantar | Trabalho observado / liveness inferida |
| **B. Circulação** | Corredores claros 2 tiles | Walk ambient | Não é trabalho |
| **C. Lounge / play** | Mesa ping-pong, pool, cartas, bola | Só idle ambient-eligible | Ambient inventado localmente |
| **D. Jardim / janela** | Plantas, luz, vaso | Idle (plantio) | Ambient; sem “gardening XP” |
| **E. Entrada / foyer** | Porta, tapete, placa | Spawn/despawn consultor | Lifecycle visual |
| **F. Quadro de status** (prop UI no mundo ou strip) | Espelho da health strip | — | Redundância glanceable |

### Layout sugerido (ASCII)

```
┌──────── foyer ────────┐
│  door                 │
├───────┬───────────────┤
│ lounge│  work floor   │
│ ping  │  desk desk    │
│ pool  │  desk desk    │
│ cards │               │
├───────┴───────────────┤
│ garden / window light │
└───────────────────────┘
```

### Regras de ocupação

- Cada consultor tem **workstation home** estável (índice na fila) — evita reshuffle visual a cada tick.  
- Collaborators orbitam o pai (±1–2 tiles), sprites menores, sem mesa própria.  
- Active: sentado na mesa, animação de trabalho (teclado/monitor).  
- Stale: sentado ou semi-afastado, pose “congelada”, alpha/dither — **sem** animação de typing.  
- Idle ambient: pode deixar a mesa; home desk permanece (cadeira vazia + accent).  
- Expiry 24h: walk-out pela porta ou fade no foyer (1.2–2.0s), depois remoção.  
- Empty office: mapa mobiliado + cue “Waiting for Cursor activity” — **zero NPCs inventados**.

---

## 5. Gramática visual do NPC e lifecycle

### Camadas de sinal (redundantes)

| Camada | Canal | Uso |
| --- | --- | --- |
| Pose / loco | postura + path | active sentado; ambient andando/jogando; stale estático |
| Motion budget | taxa de frames | active: typing loop curto; ambient: ciclo lento; stale: 0 loco |
| Badge de proveniência | forma + cor + texto acessível | observed ● · inferred ◆ · ambient ○ · stale ░ |
| Accent | hue estável (já no domínio) | identidade entre consultores |
| Label | `Consultant · AB12` | sem conteúdo de trabalho |
| Alpha / outline | 1.0 vs ~0.55 | stale / collaborator secundário |
| Escala | consultor 16×24–32; collab ~70% | hierarquia pai/filho |

### Estados do consultor (produto → visual)

| Estado produto | Proveniência | Visual obrigatório | Proibido |
| --- | --- | --- | --- |
| **Active (observed)** | observed | Sentado; typing/monitor glow; badge observed; strip pode dizer `observed` | Ambient play; idle walk |
| **Idle (observed)** | observed → badge **ambient** quando em loco | Pode sair da mesa; play/rest/socialize; badge ambient ou idle+ambient | Typing; glow de “trabalhando” |
| **Stale (inferred)** | inferred | Alpha ↓; pose congelada; badge stale; sem typing | Ambient play que pareça “ok / idle observado” |
| **Absent / expired** | — | Removido do floor | Fantasma permanente |
| **New visit** pós-expiry | observed | Re-entrada pela porta; nova visita, mesma identity visual se mesmo conversation | Continuidade falsa de sessão sem evidência |

### Collaborator

- Aparece com `subagentStart`; some em stop match ou fallback 30m.  
- Label = `collaboratorType` (já no view model).  
- Sem mesa; sem accent hue próprio (ou hue = pai dessaturado).  
- workState active|stale apenas; sem ambient play solo.  
- Nunca altera lease do pai.

### Observer / shell health (strip)

| Health | Quando (código atual) | Visual strip |
| --- | --- | --- |
| `disconnected` | hooks não instalados | Neutro/alerta textual |
| `waiting` | instalado, 0 consultores | Office vazio + waiting cue |
| `observed` | ≥1 active | Strip enfatiza trabalho observado |
| `ambient` | só idle | Strip deixa claro: motion ≠ work |
| `stale` | ≥1 stale | Prioridade sobre ambient (já no `getHealth`) |
| `connected` | fallback | Pronto |

**Blocked/error (design, ainda fino no MVP):** falha de install → `connect__error` + role=alert; observer down com app aberto → detail textual “Observer not listening”; **não** fabricar idle.

### Desconectado vs stale (crítico)

- **Disconnected:** não há observação confiável da integração.  
- **Stale:** há consultor retido, mas liveness é **inferida** (ex.: restart sem stop).  
Nunca usar o mesmo visual para os dois.

---

## 6. Regras de movimento / animação (real vs ambient)

### Autoridade (já no código — preservar)

- AmbientDirector lê só `ambientEligible` (`idle` + `observed`).  
- Ambient **não** escreve `lastObservedAt` / lease.  
- Reactivation / perda de elegibilidade → `interrupt()`.  
- `prefers-reduced-motion: reduce` → behavior `rest`, offsets 0.

### Matriz de animação

| Trigger | Fonte | Animação | Lease |
| --- | --- | --- | --- |
| `work_observed` | evento real | Snap à mesa + typing loop | refresca (domínio) |
| `generation_stopped` | evento real | Para typing → idle pose → elegível ambient | não refresca por ambient |
| Restart unfinished | inferido | Stale pose; sem typing | lease intacto |
| Ambient walk/play/socialize/rest | local | Paths em B/C/D | **nunca** |
| Collaborator start/stop | evento real | Spawn/despawn perto do pai | fallback 30m; não refresca pai |
| Lease 24h | clock | Exit foyer | remove |

### Orçamento de motion (MVP)

- **Active work:** 2–4 frames typing; monitor blink ≤1 Hz; sem pathfinding.  
- **Ambient:** ≤1 NPC “em destaque” de play por vez se ≥3 idle; outros rest/walk lento.  
- **Global FPS art:** loops 4–8 fps nos sprites; Pixi ticker pode interpolar posição, mas arte em frames discretos.  
- **Attention capture:** só transição active↔idle e spawn/despawn usam accent flash ≤300ms; ambient nunca “ping” agressivo (CHI 2025: noticeability vs distraction).  
- **Reduced motion:** estados por pose + badge + texto; zero loco.

### Ambient permitido (lista fechada MVP)

`rest` · `walk` · `play` (ping-pong | pool | cards | ball) · `socialize` · `plant`  
Todos devem ser **visualmente recreativos** (props de lazer/jardim), nunca laptop/código/terminal.

---

## 7. Arquétipos de personagem (roles/skins, nunca semântica do bot)

Arquétipos são **fantasias visuais** atribuídas por hash estável de `sourceId:conversationId` — **não** inferem “este bot é coder/researcher”.

| ID | Nome de skin | Sinais visuais (originais) | Notas |
| --- | --- | --- | --- |
| A | **Desk Pilot** | Suéter, fones, cabelo curto | Default mais neutro |
| B | **Field Note** | Colete, bolsa lateral, óculos | |
| C | **Night Shift** | Moletom capuz baixo, caneca | Evitar “hacker hoodie” clichê roxo neon |
| D | **Gallery Host** | Blazer leve, cachecol fino | |
| E | **Greenhouse** | Avental de jardim, luvas no idle plant | Só visual; não implica bot de botânica |
| F | **Visitor** (collaborator) | Sprite menor, silhueta simplificada, sem mesa | Temporário |

**Regras**

- 4–6 skins consultor + 1–2 visitor bastam no MVP.  
- Paleta de pele/cabelo/roupa deve funcionar com accent hue no desk/cadeira, não no skin tone.  
- Proibido: mapear `collaboratorType` → arquétipo “especialista” sem pedido explícito do usuário.  
- Nomes de skin nunca aparecem na UI de status (só label identity).

---

## 8. Spec técnica de arte

### Grid e escala

| Parâmetro | Valor MVP |
| --- | --- |
| Tile | **16×16 px** |
| Personagem consultor | **16×24 a 16×32** (1×1.5–2 tiles; top-down com overlap Y) |
| Collaborator | **12×18 a 14×22** |
| Props grandes | 16×16 / 32×16 / 32×32 |
| World lógico | ~**640×360** (40×22.5 tiles) ou **640×384** |
| Viewport window | 1280×800 típico → scale inteiro **×2** (letterbox/pillarbox se preciso) |
| Pixel snap | obrigatório; sem antialias em sprites (Pixi: round pixels / nearest) |
| UI chrome | pode ser vetorial/CSS (shell atual); mundo = pixel-perfect |

### Estratégia de paleta

- **Base office (fixa):** 12–16 cores: madeiras claras, azul-ardósia `#2f6f8f` (já no CSS), tinta `#1c2430`, papel `#e8eef4`, stage `#d7e2ec`.  
- **Accent por NPC:** hue do domínio em saturacão controlada (desk/chair/mug) — não recolorir pele.  
- **Estado:**  
  - observed: teal-slate sólido  
  - inferred/stale: âmbar terroso `#b0892c` / `#8b5a2b` (já nos badges)  
  - ambient: cinza-azulado `#5a6675`  
  - error: `#8b2e2e` (só chrome)  
- Evitar: purple-glow AI default; cream+terracotta farm-core; neon cyber.  
- Testar daltonismo (protanopia/deuteranopia): forma do badge + pose + texto strip.

### Tipografia

- Shell: manter direção serif editorial atual (`Iowan Old Style` / Palatino / Georgia) — contraste com pixel world.  
- Labels no canvas: bitmap 5×7 ou 7×7 **ou** texto Pixi em 10–12px com fill alto contraste; preferir bitmap para pixel-perfect.  
- Status strip: UI system/serif do shell; `uppercase` label curto + detail.

### Ícones

- Strip: 1 glyph por health (plug / hourglass / pulse / leaf / warn) **sempre** com texto.  
- Badges no sprite: formas geométricas simples (círculo, diamante, anel, hatch) — não ícones Stardew-like de energia/farming.

---

## 9. Regras de acessibilidade

1. **WCAG 1.4.1:** estado nunca só por cor — forma badge + label + (quando possível) pose.  
2. **WCAG 1.4.3 / 1.4.11:** texto ≥4.5:1; badges/ícones de estado ≥3:1 contra floor.  
3. **`prefers-reduced-motion`:** já parcialmente no scene — expandir: sem blink de monitor; crossfade em vez de walk-out.  
4. **VoiceOver / AT:**  
   - Status strip com `aria-live="polite"` (já existe).  
   - Região “Office roster” em HTML espelho (lista) com cada consultor: `Consultant AB12, active, observed` — canvas Pixi sozinho não é acessível.  
   - Botões Integration/Connect com focus-visible (já).  
5. **Teclado:** `⌘,` settings; Escape fecha modal; tab order linear.  
6. **Daltonismo:** simular protan/deutan nos badges; accent hues espaçados (≥30°) quando possível.  
7. **Privacidade acessível:** labels nunca incluem path/prompt; roster AT usa os mesmos campos allowlisted.  
8. **Fail soft:** se canvas falhar, shell + roster textual ainda comunicam estados.

---

## 10. Inventário exato de telas/estados (para Stitch)

Cada item = frame/tela a desenhar. Tags: `SHELL` | `OFFICE` | `NPC` | `MODAL`.

### A. Shell / onboarding / settings

| ID | Nome | Conteúdo |
| --- | --- | --- |
| S01 | First launch — Connect Cursor | Overlay preview hooks, fields, path, diff, CTA Confirm |
| S02 | Connect error | Alert; Cursor config inalterado |
| S03 | Connected empty (waiting) | Strip `waiting`; office mobiliado; cue central |
| S04 | Integration settings open | Modal uninstall / status; stage dimmed |
| S05 | Uninstalled | Volta a S01; office sem observação |
| S06 | Disconnected strip | Strip `disconnected`; stage pode estar vazio |
| S07 | Security error (node leak) | Estado raro de debug — chrome only |

### B. Office macro states

| ID | Nome |
| --- | --- |
| O01 | Empty furnished office + waiting |
| O02 | One consultant active |
| O03 | One consultant idle ambient (lounge) |
| O04 | One consultant stale/inferred |
| O05 | Two+ consultants mixed states |
| O06 | Consultant + collaborator(s) |
| O07 | Many consultants (dense) — crowding rules |
| O08 | Ambient socialize (2 idle) |
| O09 | Night/day opcional MVP? — **não**; uma iluminação só |
| O10 | Window resize narrow (900×600) |
| O11 | Window wide (1280×800 / 1470×900) |
| O12 | Reduced-motion: idle sem loco |
| O13 | Exit / expiry walk-out |
| O14 | Spawn / enter foyer |

### C. NPC state close-ups (sheet)

| ID | Estado |
| --- | --- |
| N01 | Active typing @ desk |
| N02 | Idle rest @ desk |
| N03 | Idle walk corridor |
| N04 | Play ping-pong |
| N05 | Play pool |
| N06 | Play cards |
| N07 | Play ball |
| N08 | Planting |
| N09 | Socialize (facing) |
| N10 | Stale frozen |
| N11 | Collaborator active |
| N12 | Collaborator stale |
| N13 | Badge set: observed / inferred / ambient / stale |
| N14 | Label + accent desk variants (3 hues sample) |

### D. Strip states

| ID | Health |
| --- | --- |
| H01 | disconnected |
| H02 | waiting |
| H03 | connected |
| H04 | observed |
| H05 | ambient |
| H06 | stale |
| H07 | inferred (se exposto no strip além de stale) |

**Entrega Stitch:** 1 master office board + frames S01–S06, O01–O08, O12–O14, N01–N14, H01–H07; anotar proveniência em cada frame.

---

## 11. Lista priorizada de assets MVP

### P0 — Bloqueadores de glanceability (ship)

| Asset | Count | Critério de aceite |
| --- | --- | --- |
| Tileset chão/parede/janela | 12–16 tiles | Integer scale; contraste mesa/chão ≥3:1 em silhueta |
| Desk + chair (tintable accent) | 2 props + mask hue | Accent só em madeira/objeto, não pele |
| Monitor + PC | 1–2 | Glow só em active |
| Consultor base + 4 skins | 4 spritesheets | Idle/active/stale poses distintas sem cor-only |
| Walk cycle 4 dir | 4×4 frames | Pixel snap; loop ≤8 fps |
| Typing loop | 2–4 frames | Só active observed |
| Badge shapes 4 | 4 | Formas distintas B/W |
| Collaborator visitor | 1 sheet | ~70% escala; 2 poses |
| Foyer door | 1–2 | Usável em spawn/despawn |
| Waiting cue style | 1 | Texto + opcional prop; sem NPC fake |
| Strip icons | 5–7 | Sempre com label textual |

### P1 — Ambient legítimo

| Asset | Count | Aceite |
| --- | --- | --- |
| Ping-pong table + paddles | 1 set | Idle only |
| Pool table | 1 | Idle only |
| Cards table | 1 | Idle only |
| Ball prop | 1 | Idle only |
| Plant pots + plant action | 2–3 + 3 frames | Não parece “trabalho” |
| Lounge chairs | 2 | Rest |
| Socialize talk frames | 2 | Facing pair |

### P2 — Polish

| Asset | Count | Aceite |
| --- | --- | --- |
| Window light / soft shadow tiles | 4–6 | Sem bloom neon |
| Exit walk frames | 4 | ≤2s |
| Empty chair “home” marker | 1 | Accent residual |
| Bitmap font atlas | 1 | Labels canvas |

### Fora do MVP

Múltiplas skins de mapa, weather, day/night cycle, emotes de emoção do “bot”, minigames jogáveis, avatares custom do usuário, Cloud Agent zones.

---

## 12. Riscos / IP guardrails — o que **não** copiar

| Proibido | Por quê |
| --- | --- |
| Sprites, tiles, UI, fontes ou SFX de Stardew Valley | Copyright |
| Layout de fazenda/cidade Pelican, Community Center, etc. | Trade dress / mapa |
| Paleta e “feel” reconhecível de SV (energia, forragem, heart events) | Imitação de identidade |
| Personagens “farmer/spouse” arquétipos SV | Associação indevida |
| Copiar Gather/Discord avatares ou ícones proprietários | Marca de terceiros |
| Cursor mark em props do mundo sem guideline oficial | Brand misuse |
| Qualquer texto de prompt/arquivo na arte ou mock | Violação privacy allowlist |
| Animação de “coding furiously” sem evento | Mentira de produto |

**Permitido:** *feeling* de aconchego top-down; referências de processo (SLYNYRD sizing, calm tech); paleta original Harbor Desk; arquitetura de escritório contemporâneo nórdico/atelier.

**Teste de originalidade:** se um frame ainda “parece Stardew” com labels removidas, redesign (roupas, telhados, vegetação, UI hearts/energy).

---

## 13. Três conceitos de art direction → recomendação

### Conceito A — “Terminal Greenhouse”

- Estufa + mesas de trabalho entre plantas densas.  
- Paleta: verde-musgo, vidro, metal fosco.  
- **Prós:** ambient plant naturalmente; memorável.  
- **Contras:** risco de farm-core / SV adjacency; green pode colidir com “online = verde”.

### Conceito B — “Midnight Switchboard”

- Escritório noturno, LEDs frios, carpete escuro.  
- **Prós:** contraste alto para badges; vibe “ops center”.  
- **Contras:** compete com Cursor dark UI; cansa como ambient all-day; viola preferência light do shell atual; atrai glow-cliché.

### Conceito C — “Harbor Desk / Atelier Norte” ✅ recomendado

- Escandinavo claro: madeira de pinho, azul-ardósia, papel, luz de janela norte, lounge discreto.  
- Alinha ao CSS atual (`--paper`, `--accent #2f6f8f`, serif editorial).  
- **Prós:** calmo o dia inteiro; contraste suficiente; longe de farm fantasy; tipografia shell + pixel world criam identidade própria; lounge/jardim cabem sem virar fazenda.  
- **Contras:** precisa disciplina para não ficar “stock cozy AI”; exigir props concretos (porto/atelier: mapa na parede, planta em vaso, janela com horizonte suave — sem farol/Stardew pier).

### Por que C

1. Continuidade com o shell MVP já shipped.  
2. Melhor encaixa em Calm Technology / peripheral all-day.  
3. Separação clara work floor vs lounge sem tropo agrícola.  
4. Accent hues legíveis em madeira clara.  
5. Menor risco de IP vs fantasy farming.

---

## Mapeamento para o código atual (âncoras de implementação futura)

| Já existe | Implicação de design |
| --- | --- |
| `badgeFor`: idle+observed → `ambient` | Arte deve tratar badge ambient ≠ “offline” |
| `AmbientDirector` behaviors | Mapear play → props reais; hoje só offset senoidal |
| Procedural `createFloor` / circle avatars | Substituir por tiles/sprites; manter contratos de view model |
| Label `Consultant · ${labelSuffix}` | Manter; não promover nomes semânticos |
| `accentHue` 0–360 | Desk/chair tint only |
| Health prioritizes stale over ambient | Strip e “temperature” do mapa podem ecoar isso |
| Waiting label serif 18px | Evoluir para cue integrado ao foyer |
| antialias: true no Pixi hoje | Para pixel art: nearest + integer scale |

---

## Critérios de sucesso do design (aceitação visual)

- Em ≤1s, usuário distingue active vs idle vs stale vs disconnected.  
- Ambient nunca é confudível com typing.  
- Dois consultores distinguíveis só com label+accent (sem conteúdo).  
- Reduced-motion e roster AT contam a mesma história.  
- Nenhum frame de referência de Stardew/IP de terceiros no moodboard final.  
- Stitch cobre o inventário da §10 com anotações de proveniência.

---

## Próximos passos sugeridos (fora deste doc)

1. Moodboard Harbor Desk (refs originais only).  
2. Stitch: S01, O02, O03, O04, O06, N13 primeiro.  
3. Validar badges em simulador CVD.  
4. Só então substituir assets procedurais no Pixi.
