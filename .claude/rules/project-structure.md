# Project structure

```
src/
  app/
    layout.tsx           # static server component: PWA meta, fonts, blocking inline theme-init script (first node in <body>), renders <ServiceWorkerInit/>
    ServiceWorkerInit.tsx # client island: registers the service worker on mount
    page.tsx             # redirect → /study
    login/
      page.tsx           # password form
      page.helpers.ts    # requestLogin() — POST /api/login, map result
      page.helpers.test.ts
    study/
      page.tsx           # main: queue, grading, filter, stats, daily-reading modal (sync via useProgressSync)
      page.helpers.ts    # gradeWord / buildQueue / queueBoxCounts / progressFor (shuffle re-exported from lib/shuffle)
      page.helpers.test.ts
    read/
      page.tsx           # daily reading: today's pick + browsable list of all texts
      page.helpers.ts    # groupByTopic()
      page.helpers.test.ts
    dictation/
      page.tsx           # dictation exercise: gap-fill cards, session queue, stats
      page.helpers.ts    # buildDictationQueue / sessionStats
      page.helpers.test.ts
    grammar/
      page.tsx           # read-only grammar reference: category sections + expandable topic cards; per-topic + smart-quiz links
      page.helpers.ts    # activeGroups / toggleOpen / splitParagraphs
      page.helpers.test.ts
      quiz/
        page.tsx         # grammar quiz: per-topic (?topic=id) or smart-mix session; queue, grading, stats
        page.helpers.ts  # buildSmartQuiz (tiered, struggling-first) / buildTopicQuiz / sessionStats / QUIZ_SESSION_SIZE
        page.helpers.test.ts
    settings/
      page.tsx           # AI on/off toggle + learnerLevel chip row (per-device localStorage, no sync)
      page.helpers.ts    # LEARNER_LEVEL_OPTIONS
      page.helpers.test.ts
    api/login/route.ts
    api/progress/route.ts
    api/dictation/route.ts
    api/grammar-quiz/route.ts
    api/ai/route.ts        # GET (configured? boolean) + POST, Edge runtime, streaming: JWT-gated BYOK AI proxy (word-intents only)
    api/ai/route.test.ts
  components/             # one folder per component: index.tsx + index.helpers.ts + test
    shared/              # small cross-page primitives with no feature of their own
      Accordion/         # FlyonUI accordion classes, React-owned open state, 0fr->1fr grid height animation (no FlyonUI JS)
        index.tsx
        index.helpers.ts # toggleExclusive()
        index.helpers.test.ts
      Chip/              # toggleable pill button (active/disabled) used by FilterBar and per-page level filters
        index.tsx
        index.helpers.ts # chipClass()
        index.helpers.test.ts
      Modal/             # centered dialog: safe-area insets, Escape/focus-trap/scroll-lock, initial + restored focus
        index.tsx
        index.helpers.ts # focusableElements()
        index.helpers.test.ts
      LoadingScreen/     # centered spinner for a page's `!ready` state
        index.tsx
      SessionSummary/    # "N/M, X% correct" + a restart button, shared by study/dictation/grammar-quiz
        index.tsx
    AppNav/              # hamburger menu (mobile) + inline links (desktop); logout; active-route highlight
    DailyReading/        # daily A1/A2 text: highlighted target words, delegates the tap popover to WordPopover
      index.tsx          # props: text, strugglingIds?, highlightAll?, onUnauthorized? (filter vs two-tier mode)
      index.helpers.ts   # toSegments() / resolveHighlight()
      index.helpers.test.ts
    WordPopover/         # offline gloss (article/plural/meaning/speak) + AI chip row + free-ask, streamed reply
      index.tsx
      index.helpers.ts   # glossFor() / shouldFlipBelow() / horizontalOffset() / chipsForPos() / CHIP_LABELS
      index.helpers.test.ts
    FlashCard/           # 3D flip, German front / English+example back, Skip pre-flip / grade buttons post-flip
      index.tsx
      index.helpers.ts   # article/plural colours, resultBoxes()
      index.helpers.test.ts
    FilterBar/           # box (incl. "Due") / type / level chips — chip option lists live in @/constants
      index.tsx
    LeitnerStats/        # box distribution bars
      index.tsx
      index.helpers.ts   # statBars()
      index.helpers.test.ts
    DictationCard/       # gap-fill dictation card: question → result with article + gap highlight
      index.tsx
      index.helpers.ts   # checkAnswer() / fullDisplay() / gapInputWidth() / ARTICLE_COLOR
      index.helpers.test.ts
    GrammarTableView/    # renders a GrammarTable as a styled grid
      index.tsx
    GrammarExampleView/  # renders a GrammarExample (de + muted en)
      index.tsx
    GrammarQuizCard/     # multiple-choice quiz card: prompt → choice buttons → result; Skip / Next; keyboard 1–N + Enter
      index.tsx
      index.helpers.ts   # choiceStyle()
      index.helpers.test.ts
    SpeakButton/         # pronunciation button (Web Speech API, German voice)
      index.tsx
      index.helpers.ts   # speakButtonClass()
      index.helpers.test.ts
  constants/
    index.ts             # GRADE / POS / ARTICLE / ARTICLE_COLOR / PLURAL_COLOR / BOXES / LEVELS / FILTER / WORD_INTENTS / POS_CHIPS / BOX_CHIPS / LEVEL_CHIPS / THEME_COLOR / THEME_STORAGE_KEY / DESKTOP_MEDIA_QUERY value constants
  lib/
    theme-prefs.ts       # per-device localStorage theme pref (never synced): getTheme/setTheme; also updates the theme-color <meta> tag
    words.ts             # import words.json; allWords / wordById / wordLevel / filterWords (source + level)
    daily-texts.ts       # import daily-texts.json; dailyTexts, dailyTextById
    grammar.ts           # import grammar.json; grammarTopics, topicsByCategory, grammarTopicById
    grammar-quiz.ts      # thin lookup over the frozen grammar-bank.json; generateQuestionsForTopic / allQuizzableTopicIds / isQuizzableTopic
    grammar-quiz-sync.ts # IndexedDB load/save + remote sync + mergeGrammarQuiz for GrammarQuizProgressMap
    daily.ts             # strugglingIds / scoreText / pickDailyText + once-per-day localStorage gating
    leitner.ts           # intervals, isDue, onGood/onMiss/onEasy, counts
    shuffle.ts           # shuffle(): Fisher–Yates array shuffle (re-exported by study/page.helpers)
    dictation.ts         # generateGap(): ranked spelling-difficulty ruleset → Gap
    auth.ts              # signToken / verifyToken (jose)
    auth-security.ts     # failedLoginRateLimiter: per-client failed-login counter in KV (fails open)
    idb.ts               # shared IndexedDB handle (getDB) — stores: progress, dictation, grammar-quiz
    db.ts                # KV load/save + mergeProgress + loadDictation/saveDictation/mergeDictation + loadGrammarQuiz/saveGrammarQuiz/mergeGrammarQuiz (server)
    sync.ts              # IndexedDB + remote load/sync + token storage + pickChanged/SYNC_DEBOUNCE_MS (client)
    dictation-sync.ts    # IndexedDB load/save + remote sync + mergeDictation for DictationProgressMap
    speech.ts            # Web Speech API: getGermanVoice / speakDE (offline, no API key)
    service-worker.ts    # shouldRegisterServiceWorker / registerServiceWorker
    ai-prefs.ts          # per-device localStorage prefs (never synced): isAiEnabled/setAiEnabled, getLearnerLevel/setLearnerLevel
    ai/
      models.ts          # MODEL_FOR_INTENT seam — every WordIntent → 'claude-sonnet-5' today
      prompts.ts         # GENERATORS-style prompt templates + ceilingLevel() register-ceiling calc (server-only)
      validate.ts        # parseAiRequest(): untrusted-body → WordIntentRequest | null, enum + length checks
      client.ts          # streamCompletion(): wraps @anthropic-ai/sdk streaming into a ReadableStream<Uint8Array>
  hooks/                 # React hooks (stateful glue), kept out of lib/ which is framework-agnostic logic
    useProgressSync.ts   # shared study/read sync: debounced KV push + keepalive flush on hide/pagehide/unmount
    useDictationSync.ts  # dictation sync: recordAttempt + toggleStar → IndexedDB + KV (mirrors useProgressSync)
    useGrammarQuizSync.ts # grammar-quiz sync: recordAttempt(topicId, correct) → IndexedDB + KV (mirrors useDictationSync)
    useSpeech.ts         # German pronunciation: available/speaking state + speak(text)
    useAiChat.ts         # POST /api/ai, streams the reply into state, clears token + onUnauthorized on 401
    useAiConfigured.ts   # GET /api/ai once on mount → whether ANTHROPIC_API_KEY is set on this deployment
    useOnline.ts         # navigator.onLine + online/offline listeners → boolean
    useMediaQuery.ts     # useSyncExternalStore over matchMedia — for components that must not *mount* at a breakpoint (mobile-only modals), where `md:hidden` would still run their effects
  types/
    index.ts             # Word, WordProgress, ProgressMap, Article, Pos, Box, DailyText, DailyTextSpan, GrammarTopic (+ related)
    grade.ts             # Grade
    filter.ts            # Filter, BoxFilter, PosFilter, LevelFilter
    stats.ts             # StatBar
    auth.ts              # LoginResult
    dictation.ts         # DictationWordProgress, DictationProgressMap
    grammar-quiz.ts      # QuizQuestion, QuizDifficulty, GrammarQuizTopicProgress, GrammarQuizProgressMap
    ai.ts                # WordIntent, AiWordFields, WordIntentRequest, AiRequest
    accordion.ts         # AccordionItem
  __tests__/             # lib-level Jest tests (not co-located)
    leitner.test.ts      # Leitner transition assertions
    merge.test.ts        # mergeProgress newest-wins assertions
    sync.test.ts         # pickChanged subset + partial-push merge assertions
    service-worker.test.ts # registration-guard assertions
    daily.test.ts        # strugglingIds / scoreText / pickDailyText assertions
    dictation.test.ts    # generateGap ruleset assertions
    shuffle.test.ts      # shuffle permutation/immutability assertions
    words.test.ts        # wordById / wordLevel / source-filter assertions
    auth-security.test.ts # failed-login rate-limit counter, window, reset, fail-open assertions
    ai-models.test.ts    # MODEL_FOR_INTENT coverage
    ai-prompts.test.ts   # ceilingLevel truth table + buildPrompt per intent
    ai-validate.test.ts  # parseAiRequest accept/reject cases
    ai-prefs.test.ts     # isAiEnabled/getLearnerLevel defaults, round-trip, corrupted-value fallback
    constants.test.ts    # ARTICLE_COLOR / LEVEL_CHIPS / POS_CHIPS / BOX_CHIPS assertions
    theme-prefs.test.ts  # getTheme/setTheme round-trip + corrupted-value fallback
public/  manifest.json, sw.js, icons/, apple-touch-icon.png
scripts/
  lib/pdf-text.mjs       # pdftotext -layout wrapper + _text/ cache
  lib/flag.mjs           # push uncertain rows to <source>_flagged.json
  extract-telc.mjs       # parse telc text → telc-a1-{1,2}.json
  extract-goethe.mjs     # parse goethe text → goethe-a1.json (A1 layout)
  extract-goethe-a2.mjs  # parse goethe A2 text → goethe-a2.json (A2 layout variant)
  build-words.mjs        # refine + merge → words.json + changelog.json
  build-daily-texts.mjs  # annotate + validate daily-texts.src.json → daily-texts.json
  build-grammar-bank.mjs # hard-gate validate + freeze grammar-bank.src.json → grammar-bank.json
  gen-icons.mjs          # generate PWA icons + apple-touch-icon.png
data/    sources/ (<level>/*.pdf + *.json per level, e.g. a1/, a2/; _text/ [gitignored]; daily-texts.src.json and grammar-bank.src.json stay at root), words.json, changelog.json, daily-texts.json, grammar.json, grammar-bank.json
```
