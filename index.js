/* eslint-disable  func-names */
/* eslint-disable  no-console */

const Alexa = require("ask-sdk-core");
const questions = require("./questions");
const i18n = require("i18next");
const sprintf = require("i18next-sprintf-postprocessor");

const ANSWER_COUNT = 4;

function populateGameQuestions(categoryQuestions) {
  const gameQuestions = [];
  const indexList = [];
  let index = categoryQuestions.length;
  let gameLength = categoryQuestions.length;
  for (let i = 0; i < categoryQuestions.length; i += 1) {
    indexList.push(i);
  }

  for (let j = 0; j < gameLength; j += 1) {
    const rand = Math.floor(Math.random() * index);
    index -= 1;

    const temp = indexList[index];
    indexList[index] = indexList[rand];
    indexList[rand] = temp;
    gameQuestions.push(indexList[index]);
  }
  return gameQuestions;
}

function populateRoundAnswers(gameQuestionIndexes, categoryQuestions) {
  const answers = gameQuestionIndexes.map(index => {
    return Object.values(categoryQuestions[index])[0];
  });
  return answers;
}

function isAnswerSlotValid(intent) {
  const answerSlotFilled =
    intent && intent.slots && intent.slots.Answer && intent.slots.Answer.value;
  return answerSlotFilled;
}

function handleUserGuess(userGaveUp, handlerInput) {
  const { requestEnvelope, attributesManager, responseBuilder } = handlerInput;
  const { intent } = requestEnvelope.request;
  const answerSlotValid = isAnswerSlotValid(intent);
  let speechOutput = "";
  let speechOutputAnalysis = "";
  const sessionAttributes = attributesManager.getSessionAttributes();
  const gameQuestions = [...sessionAttributes.questions];
  const repeatedQuestions = [...sessionAttributes.repeatedQuestions];
  let gameLength = gameQuestions.length;
  let correctAnswerIndex = parseInt(sessionAttributes.correctAnswerIndex, 10);
  let currentScore = parseInt(sessionAttributes.score, 10);
  let currentQuestionIndex = parseInt(
    sessionAttributes.currentQuestionIndex,
    10
  );
  let { correctAnswerText, roundAnswers } = sessionAttributes;
  let currentCorrectAnswer = roundAnswers[currentQuestionIndex];
  const requestAttributes = attributesManager.getRequestAttributes();
  const categoryQuestions = questions[sessionAttributes.category];
  const currentQuestion = gameQuestions[currentQuestionIndex];

  if (
    (answerSlotValid &&
      intent.slots.Answer.value.toLowerCase() ===
        currentCorrectAnswer.toLowerCase()) ||
    intent.slots.Answer.resolutions.resolutionsPerAuthority[0].values[0].value.name.toLowerCase() ===
      currentCorrectAnswer.toLowerCase()
  ) {
    currentScore += 1;
    speechOutputAnalysis = requestAttributes.t("ANSWER_CORRECT_MESSAGE");
  } else {
    if (!userGaveUp) {
      speechOutputAnalysis = requestAttributes.t("ANSWER_WRONG_MESSAGE");
    }

    const currentRepeats = gameQuestions.filter(
      question => question === currentQuestion
    );

    if (currentRepeats.length < 3) {
      gameQuestions.push(currentQuestion);
      repeatedQuestions.push(currentQuestion);
      ++gameLength;
    }

    speechOutputAnalysis += requestAttributes.t(
      "CORRECT_ANSWER_MESSAGE",
      correctAnswerText
    );
  }

  // Check if we can exit the game session after gameLength questions (zero-indexed)
  if (sessionAttributes.currentQuestionIndex === gameLength - 1) {
    speechOutput = userGaveUp ? "" : requestAttributes.t("ANSWER_IS_MESSAGE");
    speechOutput +=
      speechOutputAnalysis +
      requestAttributes.t(
        "GAME_OVER_MESSAGE",
        currentScore.toString(),
        gameLength.toString()
      );

    const repeatQuestionSummary = repeatedQuestions.reduce(
      (acc, question, i) => {
        const missedQuestion = Object.keys(
          categoryQuestions[gameQuestions[question]]
        )[0];
        if (i === repeatedQuestions.indexOf(question)) acc += missedQuestion;
        return acc;
      },
      ""
    );

    return responseBuilder
      .speak(speechOutput)
      .withSimpleCard("Repeated questions: " + repeatQuestionSummary)
      .getResponse();
  }
  currentQuestionIndex += 1;
  correctAnswerIndex = Math.floor(Math.random() * ANSWER_COUNT);
  const spokenQuestion = Object.keys(
    categoryQuestions[gameQuestions[currentQuestionIndex]]
  )[0];

  roundAnswers = populateRoundAnswers(gameQuestions, categoryQuestions);
  const questionIndexForSpeech = currentQuestionIndex + 1;
  let repromptText = requestAttributes.t(
    "TELL_QUESTION_MESSAGE",
    questionIndexForSpeech.toString(),
    spokenQuestion
  );

  speechOutput += userGaveUp ? "" : requestAttributes.t("ANSWER_IS_MESSAGE");
  speechOutput +=
    speechOutputAnalysis +
    requestAttributes.t("SCORE_IS_MESSAGE", currentScore.toString()) +
    repromptText;
  correctAnswerText = roundAnswers[currentQuestionIndex];

  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestionIndex,
    correctAnswerIndex: correctAnswerIndex + 1,
    repeatedQuestions,
    questions: gameQuestions,
    roundAnswers,
    score: currentScore,
    correctAnswerText
  });

  return responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    .withSimpleCard(requestAttributes.t("GAME_NAME"), repromptText)
    .getResponse();
}

function startGame(newGame, handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const category =
    handlerInput.requestEnvelope.request.intent.slots.Category.value;
  const categoryQuestions = questions[category];
  const gameQuestions = populateGameQuestions(categoryQuestions);
  const correctAnswerIndex = Math.floor(Math.random() * ANSWER_COUNT);

  let speechOutput = newGame
    ? requestAttributes.t(
        "NEW_GAME_MESSAGE",
        requestAttributes.t("GAME_NAME")
      ) +
      requestAttributes.t(
        "WELCOME_MESSAGE",
        categoryQuestions.length.toString()
      )
    : "";

  const roundAnswers = populateRoundAnswers(gameQuestions, categoryQuestions);
  const currentQuestionIndex = 0;
  const spokenQuestion = Object.keys(
    categoryQuestions[gameQuestions[currentQuestionIndex]]
  );

  let repromptText = requestAttributes.t(
    "TELL_QUESTION_MESSAGE",
    "1",
    spokenQuestion
  );

  speechOutput += repromptText;
  const sessionAttributes = {};

  const correctAnswerText = roundAnswers[currentQuestionIndex];

  Object.assign(sessionAttributes, {
    speechOutput: repromptText,
    repromptText,
    currentQuestionIndex,
    category,
    correctAnswerIndex: correctAnswerIndex + 1,
    repeatedQuestions: [],
    questions: gameQuestions,
    score: 0,
    roundAnswers,
    correctAnswerText
  });

  handlerInput.attributesManager.setSessionAttributes(sessionAttributes);

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    .withSimpleCard(requestAttributes.t("GAME_NAME"), repromptText)
    .getResponse();
}

function helpTheUser(newGame, handlerInput) {
  const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
  const askMessage = newGame
    ? requestAttributes.t("ASK_MESSAGE_START")
    : requestAttributes.t("REPEAT_QUESTION_MESSAGE") +
      requestAttributes.t("STOP_MESSAGE");
  const speechOutput = requestAttributes.t("HELP_MESSAGE") + askMessage;
  const repromptText = requestAttributes.t("HELP_REPROMPT") + askMessage;

  return handlerInput.responseBuilder
    .speak(speechOutput)
    .reprompt(repromptText)
    .getResponse();
}

/* jshint -W101 */
const languageString = {
  en: {
    translation: {
      QUESTIONS: questions.QUESTIONS_EN_US,
      GAME_NAME: "The Medical quiz",
      HELP_MESSAGE:
        "Just say your answer. To start a new game at any time, say, start game. ",
      REPEAT_QUESTION_MESSAGE: "To repeat the last question, say, repeat. ",
      ASK_MESSAGE_START: "Would you like to start playing?",
      HELP_REPROMPT:
        "Please give an answer to the question or say pass to move on to the next question. ",
      STOP_MESSAGE: "Would you like to keep playing?",
      CANCEL_MESSAGE: "Ok, let's play again soon.",
      NO_MESSAGE: "Ok, we'll play another time. Goodbye!",
      HELP_UNHANDLED: "Say yes to continue, or no to end the game.",
      START_UNHANDLED: "Say start to start a new game.",
      NEW_GAME_MESSAGE: "Welcome to %s. ",
      WELCOME_MESSAGE:
        "I will ask you %s questions to start, try to get as many right as you can. Just say the answer or pass to hear the answer. Wrong answers will be asked again. Let's begin. ",
      ANSWER_CORRECT_MESSAGE: "correct. ",
      ANSWER_WRONG_MESSAGE: "wrong. ",
      CORRECT_ANSWER_MESSAGE: "The correct answer is %s. ",
      ANSWER_IS_MESSAGE: "That answer is ",
      TELL_QUESTION_MESSAGE: "Question %s. %s ",
      GAME_OVER_MESSAGE:
        "You got %s out of %s questions correct. Thank you for playing!",
      SCORE_IS_MESSAGE: "Your score is %s. "
    }
  },
  "en-GB": {
    translation: {
      QUESTIONS: questions.QUESTIONS_EN_GB,
      GAME_NAME: "Medical quiz"
    }
  }
};

const WELCOME_MESSAGE = `Welcome to the Medical Quiz!  Choose a category to start. The categories cardiovascular, paediatrics or orthopedics. `;
const HELP_LAUNCH_MESSAGE = `The categories are cardiovascular, paediatrics or orthopedics. `;

const LocalizationInterceptor = {
  process(handlerInput) {
    const localizationClient = i18n.use(sprintf).init({
      lng: handlerInput.requestEnvelope.request.locale,
      overloadTranslationOptionHandler:
        sprintf.overloadTranslationOptionHandler,
      resources: languageString,
      returnObjects: true
    });

    const attributes = handlerInput.attributesManager.getRequestAttributes();
    attributes.t = function(...args) {
      return localizationClient.t(...args);
    };
  }
};

const LaunchRequest = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return (
      request.type === "LaunchRequest" ||
      (request.type === "IntentRequest" &&
        request.intent &&
        request.intent.name === "AMAZON.StartOverIntent")
    );
  },
  handle(handlerInput) {
    handlerInput.attributesManager.setSessionAttributes({});
    return handlerInput.responseBuilder
      .speak(WELCOME_MESSAGE)
      .reprompt(HELP_LAUNCH_MESSAGE)
      .getResponse();
  }
};

const CategoryIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "CategoryIntent"
    );
  },
  handle(handlerInput) {
    return startGame(true, handlerInput);
  }
};

const HelpIntent = {
  canHandle(handlerInput) {
    const { request } = handlerInput.requestEnvelope;

    return (
      request.type === "IntentRequest" &&
      request.intent.name === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();

    const newGame = !sessionAttributes.questions;
    return helpTheUser(newGame, handlerInput);
  }
};

const UnhandledIntent = {
  canHandle() {
    return true;
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    if (Object.keys(sessionAttributes).length === 0) {
      const speechOutput = requestAttributes.t("START_UNHANDLED");
      return handlerInput.attributesManager
        .speak(speechOutput)
        .reprompt(speechOutput)
        .getResponse();
    } else if (sessionAttributes.questions) {
      const speechOutput = requestAttributes.t(
        "HELP_MESSAGE",
        ANSWER_COUNT.toString()
      );
      return handlerInput.attributesManager
        .speak(speechOutput)
        .reprompt(speechOutput)
        .getResponse();
    }
    const speechOutput = requestAttributes.t("HELP_UNHANDLED");
    return handlerInput.attributesManager
      .speak(speechOutput)
      .reprompt(speechOutput)
      .getResponse();
  }
};

const SessionEndedRequest = {
  canHandle(handlerInput) {
    return handlerInput.requestEnvelope.request.type === "SessionEndedRequest";
  },
  handle(handlerInput) {
    console.log(
      `Session ended with reason: ${
        handlerInput.requestEnvelope.request.reason
      }`
    );

    return handlerInput.responseBuilder.getResponse();
  }
};

const AnswerIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      (handlerInput.requestEnvelope.request.intent.name === "AnswerIntent" ||
        handlerInput.requestEnvelope.request.intent.name === "DontKnowIntent")
    );
  },
  handle(handlerInput) {
    if (handlerInput.requestEnvelope.request.intent.name === "AnswerIntent") {
      return handleUserGuess(false, handlerInput);
    }
    return handleUserGuess(true, handlerInput);
  }
};

const RepeatIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.RepeatIntent"
    );
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    return handlerInput.responseBuilder
      .speak(sessionAttributes.speechOutput)
      .reprompt(sessionAttributes.repromptText)
      .getResponse();
  }
};

const YesIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.YesIntent"
    );
  },
  handle(handlerInput) {
    const sessionAttributes = handlerInput.attributesManager.getSessionAttributes();
    if (sessionAttributes.questions) {
      return handlerInput.responseBuilder
        .speak(sessionAttributes.speechOutput)
        .reprompt(sessionAttributes.repromptText)
        .getResponse();
    }
    return startGame(false, handlerInput);
  }
};

const StopIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.StopIntent"
    );
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = requestAttributes.t("STOP_MESSAGE");

    return handlerInput.responseBuilder
      .speak(speechOutput)
      .reprompt(speechOutput)
      .getResponse();
  }
};

const CancelIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.CancelIntent"
    );
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = requestAttributes.t("CANCEL_MESSAGE");

    return handlerInput.responseBuilder.speak(speechOutput).getResponse();
  }
};

const NoIntent = {
  canHandle(handlerInput) {
    return (
      handlerInput.requestEnvelope.request.type === "IntentRequest" &&
      handlerInput.requestEnvelope.request.intent.name === "AMAZON.NoIntent"
    );
  },
  handle(handlerInput) {
    const requestAttributes = handlerInput.attributesManager.getRequestAttributes();
    const speechOutput = requestAttributes.t("NO_MESSAGE");
    return handlerInput.responseBuilder.speak(speechOutput).getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.log(`Error handled: ${error.message}`);

    return handlerInput.responseBuilder
      .speak("Sorry, I can't understand the command. Please say again.")
      .reprompt("Sorry, I can't understand the command. Please say again.")
      .getResponse();
  }
};

const skillBuilder = Alexa.SkillBuilders.custom();
exports.handler = skillBuilder
  .addRequestHandlers(
    LaunchRequest,
    CategoryIntent,
    HelpIntent,
    AnswerIntent,
    RepeatIntent,
    YesIntent,
    StopIntent,
    CancelIntent,
    NoIntent,
    SessionEndedRequest,
    UnhandledIntent
  )
  .addRequestInterceptors(LocalizationInterceptor)
  .addErrorHandlers(ErrorHandler)
  .lambda();
