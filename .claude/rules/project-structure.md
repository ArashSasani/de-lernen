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
        page.tsx         # grammar quiz: per-topic (?topic=id) or smart-mix session; delegates the batch pipeline to useQuizQueue
        page.helpers.ts  # selectQuizTopics (pure planner) / tier / difficultyFor / sessionStats / QUIZ_SESSION_SIZE
        page.helpers.test.ts
    settings/
      page.tsx           # AI on/off toggle + learnerLevel chip row + judge-verification toggle (all per-device localStorage, no sync) + read-only MistakesList
      page.helpers.ts    # LEARNER_LEVEL_OPTIONS
      page.helpers.test.ts
    api/login/route.ts
    api/progress/route.ts
    api/dictation/route.ts
    api/grammar-quiz/route.ts
    api/mistakes/route.ts  # GET/PUT, Node runtime: JWT-gated mistakes-corpus sync; validates the PUT body (records eventually feed a prompt)
    api/mistakes/route.test.ts
    api/ai/route.ts        # GET (configured? boolean) + POST, Edge runtime: streaming word-intents, plus non-streaming JSON note/judge/grammar intents
    api/ai/route.test.ts
  components/             # one folder per component: index.tsx + index.helpers.ts + test
    shared/              # small cross-page primitives with no feature of their own
      Accordion/         # FlyonUI accordion classes, React-owned open state, 0fr->1fr grid height animation (no FlyonUI JS)
        index.tsx
        index.helpers.ts # toggleExclusive()
        index.helpers.test.ts
        index.test.tsx   # render (jsdom): aria-expanded, grid row, collapsed content inert
      Chip/              # toggleable pill button (active/disabled) used by FilterBar and per-page level filters
        index.tsx
        index.helpers.ts # chipClass()
        index.helpers.test.ts
      Modal/             # centered dialog: safe-area insets, Escape/focus-trap/scroll-lock, initial + restored focus
        index.tsx
        index.helpers.ts # focusableElements()
        index.helpers.test.ts
        index.test.tsx   # render (jsdom): initial focus, Escape, Tab wrap, scroll lock, focus restore
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
      index.tsx           # onAnswer(correct, choiceIndex); names the alternative when acceptableIndices has more than one
      index.helpers.ts   # choiceStyle() / isAcceptable() / alternativeChoice()
      index.helpers.test.ts
      index.test.tsx     # render (jsdom): verdict + index, single answer, keyboard path, alternative line, AI marker
    SpeakButton/         # pronunciation button (Web Speech API, German voice)
      index.tsx
      index.helpers.ts   # speakButtonClass()
      index.helpers.test.ts
    MistakesList/        # read-only /settings list of recent MistakeRecords, collapsed via shared/Accordion
      index.tsx
      index.helpers.ts   # relativeTime() / sortByRecency() / SOURCE_LABELS
      index.helpers.test.ts
  constants/
    index.ts             # GRADE / POS / ARTICLE / ARTICLE_COLOR / PLURAL_COLOR / BOXES / LEVELS / FILTER / WORD_INTENTS / STRUCTURED_INTENTS / POS_CHIPS / BOX_CHIPS / LEVEL_CHIPS / THEME_COLOR / THEME_STORAGE_KEY / DESKTOP_MEDIA_QUERY / GRAMMAR_BATCH_SIZE_MIN/MAX / MAX_NOTES_PER_SESSION value constants
  lib/
    theme-prefs.ts       # per-device localStorage theme pref (never synced): getTheme/setTheme; also updates the theme-color <meta> tag
    dataset.ts           # runtime-fetched corpora (ADR 013): loadDataset() / hydrateDataset(); allWords, dailyTexts, grammarBank populated in place + id indexes
    words.ts             # accessors over dataset.ts: allWords / wordById / wordLevel / filterWords (source + level)
    daily-texts.ts       # re-exports dailyTexts, dailyTextById from dataset.ts
    grammar.ts           # import grammar.json; grammarTopics, topicsByCategory, grammarTopicById
    grammar-quiz.ts      # thin lookup over the fetched bank; generateQuestionsForTopic (excludeIds + servedAt rotation) / bankPoolSize / allQuizzableTopicIds / isQuizzableTopic
    bank-rotation.ts     # per-device localStorage (never synced) served-at map: getServedAt / markServed — cross-session bank rotation
    grammar-quiz-ai.ts   # sourceQuestions(): AI-or-bank sourcing for one QuizPlan slice, never throws, re-validates client-side
    quiz-session.ts      # pure quiz-session state: quizReducer over QuizEvents, derived phaseOf / totalOf / nextFillIndex, planFor (per-topic chunks + AI-off pool clamp, or smart mix)
    quiz-runner.ts       # React-free batch driver: startRun (bank-seeded batch 0, chained sourcing, abort-scoped events, fill), createBankCursor, createLatch
    grammar-quiz-sync.ts # IndexedDB load/save + remote sync + mergeGrammarQuiz for GrammarQuizProgressMap
    daily.ts             # strugglingIds / scoreText / pickDailyText + once-per-day localStorage gating
    leitner.ts           # intervals, isDue, onGood/onMiss/onEasy, counts
    shuffle.ts           # shuffle(): Fisher–Yates array shuffle (re-exported by study/page.helpers)
    dictation.ts         # generateGap(): ranked spelling-difficulty ruleset → Gap
    auth.ts              # signToken / verifyToken (jose)
    auth-security.ts     # failedLoginRateLimiter: per-client failed-login counter in KV (fails open)
    idb.ts               # shared IndexedDB handle (getDB) — stores: progress, dictation, grammar-quiz, mistakes (keyed, v2→3)
    merge.ts             # the one definition of every merge (progress/dictation incl. starredAt clock/grammar-quiz/mistakes) + pickEntries + stripLocal — dependency-free, used by both sides
    db.ts                # KV load/save for all four tracks (server); re-exports the merges from merge.ts, applies stripLocal on mistakes
    sync.ts              # IndexedDB + remote load/sync + token storage + pickChanged/SYNC_DEBOUNCE_MS (client)
    dictation-sync.ts    # IndexedDB load/save + remote sync + mergeDictation for DictationProgressMap
    mistakes-sync.ts     # IndexedDB load/saveMistakesLocal (batched) + remote sync + mergeMistakes (union-by-id) + pickUnpushed/stripLocal
    mistakes-gate.ts     # gateCandidate/gateCandidateWithJudge: pure write-time quality gate (hygiene + grounding vs graded ground truth incl. acceptableIndices + confidence + judge)
    mistakes-prompt.ts   # notesForPrompt(): per-topic/total-capped, newest-first, re-asserts hygiene at injection time
    speech.ts            # Web Speech API: getGermanVoice / speakDE (offline, no API key)
    service-worker.ts    # shouldRegisterServiceWorker / registerServiceWorker
    ai-prefs.ts          # per-device localStorage prefs (never synced): isAiEnabled/setAiEnabled, getLearnerLevel/setLearnerLevel, isJudgeEnabled/setJudgeEnabled (default off)
    ai/
      models.ts          # modelForIntent seam — every WordIntent/StructuredIntent (incl. 'grammar') → 'claude-sonnet-5' today
      prompts.ts         # GENERATORS-style word-intent templates + ceilingLevel(); parallel STRUCTURED_GENERATORS + buildStructuredPrompt for note/judge/grammar (server-only)
      validate.ts        # parseAiRequest(): dispatches word/note/judge/grammar; parseMistakeCandidate/parseJudgeVerdict/parseGeneratedQuestions re-validate the model's own structured output
      client.ts          # streamCompletion(): word-intent ReadableStream<Uint8Array>; completeStructured(): note/judge/grammar via messages.parse() + jsonSchemaOutputFormat
  hooks/                 # React hooks (stateful glue), kept out of lib/ which is framework-agnostic logic
    useDebouncedPush.ts  # the push lifecycle all four tracks share: dirty ids, debounce, keepalive flush on hide/pagehide/unmount
    useDebouncedPush.test.tsx
    useSyncedMap.ts      # generic keyed-track transport on top of useDebouncedPush: IndexedDB now, KV debounced, re-merge on response
    useProgressSync.ts   # study/read Leitner sync via useSyncedMap (+ route to login on a lost token)
    useDictationSync.ts  # dictation sync via useSyncedMap: recordAttempt + toggleStar (stamps starredAt)
    useGrammarQuizSync.ts # grammar-quiz sync via useSyncedMap: recordAttempt(topicId, correct)
    useQuizQueue.ts      # React adapter over lib/quiz-session (useReducer) + lib/quiz-runner: live-context ref, run per topic/restart, waiting-batch filler timer
    useQuizQueue.test.tsx # renderHook: batch-0 no-wait, pool clamp, no repeats, filler + late batch, abandoned run, Strict Mode, notes wait, offline, smart mix, toggle flip, trailing empty batch
    useMistakeNotes.ts   # the mistakes corpus's first producer: fire-and-forget note authoring on a quiz miss, per-session budget, optional judge pref
    useMistakeNotes.helpers.ts # canAuthorNote(): pure per-topic/per-session budget decision
    useMistakeNotes.helpers.test.ts
    useMistakes.ts       # mistakes-corpus transport: load/merge + debounced KV push + keepalive flush; addRecord(record) takes an already-gated record
    useSpeech.ts         # German pronunciation: available/speaking state + speak(text)
    useAiChat.ts         # POST /api/ai, streams the reply into state, clears token + onUnauthorized on 401; onDone(result) fires once on natural stream completion
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
    grammar-quiz.ts      # QuizQuestion (incl. acceptableIndices?), QuizDifficulty, GrammarQuizTopicProgress, GrammarQuizProgressMap, QuizTier, QuizPlan, QuizPhase, QuizState, QuizEvent, QuizRunContext
    mistakes.ts          # MistakeSource, MistakeRecord, MistakeCorpus
    ai.ts                # WordIntent, StructuredIntent, AiIntent, AiWordFields, WordIntentRequest, QuizMissContext, NoteIntentRequest, JudgeIntentRequest, MistakeCandidate, JudgeVerdict, GrammarIntentRequest, GeneratedQuizItem, AiRequest
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
    ai-models.test.ts    # modelForIntent coverage (word + structured intents, incl. grammar)
    ai-prompts.test.ts   # ceilingLevel truth table + buildPrompt per intent + buildStructuredPrompt for note/judge/grammar
    ai-validate.test.ts  # parseAiRequest accept/reject cases (word/note/judge/grammar) + parseMistakeCandidate/parseJudgeVerdict/parseGeneratedQuestions
    ai-prefs.test.ts     # isAiEnabled/getLearnerLevel/isJudgeEnabled defaults, round-trip, corrupted-value fallback
    grammar-quiz-ai.test.ts # sourceQuestions never throws and falls back to the bank per failure mode
    mistakes-prompt.test.ts # notesForPrompt topic filter, per-topic/total caps, hygiene re-assertion at injection
    constants.test.ts    # ARTICLE_COLOR / LEVEL_CHIPS / POS_CHIPS / BOX_CHIPS assertions
    theme-prefs.test.ts  # getTheme/setTheme round-trip + corrupted-value fallback
    mistakes-gate.test.ts # gateCandidate/gateCandidateWithJudge: every GateReject (incl. acceptableIndices set membership), fail-open judge
    mistakes-merge.test.ts # mergeMistakes union-by-id, collision, cap, sort assertions
    mistakes-sync.test.ts  # pickNewMistakes subset + pickUnpushed delta + 64KB keepalive size + stripLocal assertions
    merge-shared.test.ts   # server/client export the same merge objects; starredAt bookmark clock; per-side mistakes strip
    bank-rotation.test.ts  # served-at round-trip/corruption/prune + least-recently-served ordering across sessions
    quiz-session.test.ts   # reducer idempotency (landed/filler), immutability, phaseOf table, totalOf, planFor chunks/clamp/smart mix
    quiz-runner.test.ts    # latch, BankCursor dedupe/rotation, startRun ordering, generator context, degrade latch, abort silence, fill
public/  manifest.json, sw.js, offline.html, icons/, apple-touch-icon.png, data/ (generated from data/ by sync-public-data.mjs, gitignored)
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
  sync-public-data.mjs   # predev/prebuild: publish words/daily-texts/grammar-bank.json to public/data/ for runtime fetch
data/    sources/ (<level>/*.pdf + *.json per level, e.g. a1/, a2/; _text/ [gitignored]; daily-texts.src.json and grammar-bank.src.json stay at root), words.json, changelog.json, daily-texts.json, grammar.json, grammar-bank.json
```
