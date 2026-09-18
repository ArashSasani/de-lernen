# Project structure

```
src/
  app/
    layout.tsx           # static server component: PWA meta, fonts, renders <ServiceWorkerInit/>
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
    api/login/route.ts
    api/progress/route.ts
    api/dictation/route.ts
    api/grammar-quiz/route.ts
  components/             # one folder per component: index.tsx + index.helpers.ts + test
    AppNav/              # hamburger menu (mobile) + inline links (desktop); logout; active-route highlight
    DailyReading/        # daily A1/A2 text: highlighted target words, tap-for-gloss popover
      index.tsx          # props: text, strugglingIds?, highlightAll? (filter vs two-tier mode)
      index.helpers.ts   # toSegments() / glossFor() / resolveHighlight()
      index.helpers.test.ts
    FlashCard/           # 3D flip, German front / English+example back, Skip pre-flip / grade buttons post-flip
      index.tsx
      index.helpers.ts   # article/plural colours, resultBoxes()
      index.helpers.test.ts
    FilterBar/           # box (incl. "Due") / type / level chips
      index.tsx
      index.helpers.ts   # POS_CHIPS, BOX_CHIPS, LEVEL_CHIPS
      index.helpers.test.ts
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
    index.ts             # GRADE / POS / ARTICLE / ARTICLE_COLOR / BOXES / LEVELS / FILTER value constants
  lib/
    words.ts             # import words.json; wordById + source-filter helper
    daily-texts.ts       # import daily-texts.json; dailyTexts, dailyTextById
    grammar.ts           # import grammar.json; grammarTopics, topicsByCategory, grammarTopicById
    grammar-quiz.ts      # thin lookup over the frozen grammar-bank.json; generateQuestionsForTopic / allQuizzableTopicIds / isQuizzableTopic
    grammar-quiz-sync.ts # IndexedDB load/save + remote sync + mergeGrammarQuiz for GrammarQuizProgressMap
    daily.ts             # strugglingIds / scoreText / pickDailyText + once-per-day localStorage gating
    leitner.ts           # intervals, isDue, onGood/onMiss/onEasy, counts
    shuffle.ts           # shuffle(): Fisher–Yates array shuffle (re-exported by study/page.helpers)
    dictation.ts         # generateGap(): ranked spelling-difficulty ruleset → Gap
    auth.ts              # signToken / verifyToken (jose)
    idb.ts               # shared IndexedDB handle (getDB) — stores: progress, dictation, grammar-quiz
    db.ts                # KV load/save + mergeProgress + loadDictation/saveDictation/mergeDictation + loadGrammarQuiz/saveGrammarQuiz/mergeGrammarQuiz (server)
    sync.ts              # IndexedDB + remote load/sync + token storage + pickChanged/SYNC_DEBOUNCE_MS (client)
    dictation-sync.ts    # IndexedDB load/save + remote sync + mergeDictation for DictationProgressMap
    speech.ts            # Web Speech API: getGermanVoice / speakDE (offline, no API key)
    service-worker.ts    # shouldRegisterServiceWorker / registerServiceWorker
  hooks/                 # React hooks (stateful glue), kept out of lib/ which is framework-agnostic logic
    useProgressSync.ts   # shared study/read sync: debounced KV push + keepalive flush on hide/pagehide/unmount
    useDictationSync.ts  # dictation sync: recordAttempt + toggleStar → IndexedDB + KV (mirrors useProgressSync)
    useGrammarQuizSync.ts # grammar-quiz sync: recordAttempt(topicId, correct) → IndexedDB + KV (mirrors useDictationSync)
    useSpeech.ts         # German pronunciation: available/speaking state + speak(text)
  types/
    index.ts             # Word, WordProgress, ProgressMap, Article, Pos, Box, DailyText, DailyTextSpan, GrammarTopic (+ related)
    grade.ts             # Grade
    filter.ts            # Filter, BoxFilter, PosFilter, LevelFilter
    stats.ts             # StatBar
    auth.ts              # LoginResult
    dictation.ts         # DictationWordProgress, DictationProgressMap
    grammar-quiz.ts      # QuizQuestion, QuizDifficulty, GrammarQuizTopicProgress, GrammarQuizProgressMap
  __tests__/             # lib-level Jest tests (not co-located)
    leitner.test.ts      # Leitner transition assertions
    merge.test.ts        # mergeProgress newest-wins assertions
    sync.test.ts         # pickChanged subset + partial-push merge assertions
    service-worker.test.ts # registration-guard assertions
    daily.test.ts        # strugglingIds / scoreText / pickDailyText assertions
    dictation.test.ts    # generateGap ruleset assertions
    shuffle.test.ts      # shuffle permutation/immutability assertions
    words.test.ts        # wordById / wordLevel / source-filter assertions
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
