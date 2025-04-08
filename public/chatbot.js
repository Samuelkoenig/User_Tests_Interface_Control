/**
 * @fileoverview This script contains the logic of the chatbot interface and is executed by the 
 * client in the browser. 
 * @author Samuel König <koenigsamuel99@gmx.de>
 * @version 1.0.0
 */

/**************************************************************************
 * Initialization of page elements, variables and event listeners
 **************************************************************************/

/**
 * Definition of the variables used in the script. 
 * 
 * - chatbotPage @type {number}: the page number where the chatbot appears.
 * - enterMeansSent @type {boolean}: Variable to specify whether a message is sent when pressing enter. 
 * - typingAnimationDelay @type {number}: The delay in milliseconds until the typing indicator is 
 *   displayed after a user message. 
 * - initialTypingAnimationDelay @type {number}: The delay in milliseconds until the typing indicator 
 *   is displayed for the initial welcome message by the chatbot. 
 * - initialBotMessageDelay @type {number}: The delay in milliseconds until the initial welcome message 
 *   by the chatbot is displayed. 
 * - conversationId @type {string}: The conversationId generated by the bot framework.
 * - watermark @type {number}: The watermark per chatbot activity retrieval.
 * - typingIndicatorTimeout @type {number|null}: The timer id for the typing animation delay. 
 * - chatbotAlreadyOpened @type {boolean}: a flag indicating whether the chatbot has 
 *   already been opened in the session. 
 * - pollInProgress @type {boolean}: A flag indicating whether a chatbot activity retrieval process is 
 *   currently in progress. 
 * - sendInProgress @type {boolean}: A flag indicating whether a process of sending a user message to the
 *   server is still in progress.
 * - startConvInProgress @type {boolean}: A flag indicating whether the conversation initialization process
 *   is currently in progress.
 * - finalStateReached @type {boolean}: Flag to specify whether the final dialogue state has been reached.
 */
const enterMeansSend = false;             // To be specified: whether a message is sent when pressing enter!
const typingAnimationDelay = 750        // To be specified: delay of the typing animation!
const initialTypingAnimationDelay = 250  // To be specified: typing animation delay of initial bot message!
const initialBotMessageDelay = 800       // To be specified: delay of the initial bot message!

let conversationId = null;
let watermark = null;
let typingIndicatorTimeout = null;
let chatbotAlreadyOpened = sessionStorage.getItem('chatbotAlreadyOpened') === 'true';
let pollInProgress = sessionStorage.getItem('pollInProgress') === 'true';
let sendInProgress = sessionStorage.getItem('sendInProgress') === 'true'; 
let startConvInProgress = sessionStorage.getItem('startConvInProgress') === 'true';
let finalStateReached = sessionStorage.getItem('finalStateReached') === 'true'; 

/**
 * Event Listener for initializing the chatbot interface.
 * Executes the initializeChatbotUi() function as soon as the "surveyDataInitialized" event 
 * (see script.js) has been triggered.
 */
document.addEventListener('surveyDataInitialized', initializeChatbotUi);

/**
 * Initializes the chatbot interface.
 * This function is executed as soon as the "surveyDataInitialized" event has been triggered. 
 * 
 * - Starts a new conversation or restores an existing conversation.
 * - Calls the continueChatbotApiRequests function to continue any communication processes
 *   with the server which were still in progress when the page was reloaded. 
 * - Attaches all event listeners.
 * - Sets the state of the continueSurveytBtn (disabled vs. enabled).
 * 
 * @returns {void}
 */
function initializeChatbotUi() {
  const storedConversation = sessionStorage.getItem('conversation');
  if (storedConversation) {
    restoreConversation(storedConversation);
    continueChatbotApiRequests();
  } else {
    continueChatbotApiRequests();
    startConversation();
  }

  attachMobileChatbotEventListeners();
  attachChatbotEventListeners();
}

/**
 * Adds event listeners to all relevant chatbot interface DOM elements (buttons and inputs).
 * 
 * - When the user clicks on the send button, the collectUserMessage() function is called and 
 *   the height of the textarea is adjusted. 
 * - Optionally: When the user clicks enter in the textarea, this is treated as clicking the 
 *   send button (this applies when the variable enterMeansSent is set to true). 
 * - The height of the textarea is adjusted each time the user interacts with the textarea. 
 * - Each time the size of the browser window is adjusted or the chatbot interface is opened, 
 *   the dialogue space gets automatically scrolled down to the newest messages and the height 
 *   of the input text area is adjusted. 
 * - Initially sets the height of the user message input field. 
 * 
 * @returns {void}
 */
function attachChatbotEventListeners() {
  const textarea = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const maxRows = 6;

  sendBtn.addEventListener('click', function() {
    collectUserMessage();
    adjustTextareaHeight(textarea, maxRows);
  });

  if (enterMeansSend) {
    textarea.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendBtn.click();
      }
    });
  } // Optional if pressing enter should cause the user message to be sent. 

  textarea.addEventListener('input', function() {
    adjustTextareaHeight(textarea, maxRows);
  });

  window.addEventListener('resize', function () {
    scrollMessagesToBottom();
    adjustTextareaHeight(textarea, maxRows);
  });

  document.addEventListener('chatbotInterfaceOpened', function () {
    scrollMessagesToBottom();
    adjustTextareaHeight(textarea, maxRows);
  });

  adjustTextareaHeight(textarea, maxRows);
}

/**************************************************************************
 * Conversation initialization
 **************************************************************************/

/**
 * Requests the server to start a conversation with the chatbot.
 * 
 * - This function is only executed when a startConversation process is 
 *   not currently ongoing (so only when startConvInProgress is false).
 * - Sets the startConvInProgress variable to true at the start of the function and sets it to
 *   false when the server responded successfully.
 * - Passes the treatmentGroup value to the server to request the server to initialize
 *   a new conversation with the chatbot. This process is repeated until the server sends
 *   a successfull response. 
 * - Receives the conversationId value from the server.
 * - Calls the getActivities() function to receive the initial welcome message by the chatbot. 
 * 
 * @async
 * @returns {void}
 */
async function startConversation() {
  if (startConvInProgress) return;
  startConvInProgress = true;
  sessionStorage.setItem('startConvInProgress', startConvInProgress);
  const treatmentGroup = sessionStorage.getItem('treatmentGroup');
  let data;
  while (true) {
    try {
      const res = await fetch('/startconversation', {
        method: 'POST', 
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ treatmentGroup })
      });
      if (!res.ok) {
        throw new Error(`startConversation() - HTTP error! status: ${res.status}`);
      }
      startConvInProgress = false;
      sessionStorage.setItem('startConvInProgress', startConvInProgress);
      data = await res.json();
      break
    }
    catch (error) {
      console.error('Error in startConversation:', error);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  console.log(`Treatment value: ${treatmentGroup}`); // Nur zum Testen
  conversationId = data.conversationId;
  getActivities();
}

/**************************************************************************
 * Chatbot activity retrieval
 **************************************************************************/

/**
 * Requests the server to retrieve new chatbot activities.
 * 
 * - This function is only executed of there are no current chatbot activity 
 *   retrieval processes ongoing (so only when pollInProgress is false).
 * - Sets the pollInProgress variable to true at the start of the function and sets it to
 *   false when the server responded successfully (in the processActivities function
 *   after displaying new messages).
 * - Passes the conversationId, watermark and treatmentGroup values to the server.
 * - Requests the server to receives the chatbot activities. Repeats the process until it 
 *   receives a successfull response from the server (to catch network errors).
 * - Calls the processActivities(data) function to update the conversation state and 
 *   display new messages (calls the processInitialActivities(data) function instead 
 *   if the chatbot is opened for the first time in a session).
 * 
 * @async
 * @returns {void}
 */
async function getActivities() {
  if (pollInProgress) return;
  pollInProgress = true;
  sessionStorage.setItem('pollInProgress', pollInProgress);
  while (true) {
    try {
      const treatmentGroup = sessionStorage.getItem('treatmentGroup');
      const res = await fetch('/getactivities', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ conversationId, watermark, treatmentGroup })
      });
      if (!res.ok) {
        throw new Error(`pollActivities() - HTTP error! status: ${res.status}`);
      }
      const data = await res.json();
      if (data.activities) {
        const chatbotAlreadyOpenedCopy = sessionStorage.getItem('chatbotAlreadyOpened') === 'true';
        chatbotAlreadyOpenedCopy ? processActivities(data) : processInitialActivities(data);
      }
      break
    } catch (error) {
      console.error('Error fetching activities. Retrying.', error);
      await new Promise(r => setTimeout(r, 2000));
    }
  }
}

/**
 * Updates the conversation state and displays new messages. 
 * 
 * - Retrieves the conversation state from the session storage. 
 * - Hides the chatbot typing animation.
 * - Iterates through all chatbot activities, adds all new bot messages and their corresponding 
 *   activityIds to the conversation state, and displays all new messages. After having displayed 
 *   all new bot messages, sets the pollInProgress variable to false to enable new chatbot
 *   activity retrievals. 
 * - Adds an activityId to user messages which have not received an activityId yet due to 
 *   network errors. 
 * - Retrieves the finalState value metadata. If this value is true, sets the variable 
 *   finalStateReached to true, stores it in the session storage and triggers the 
 *   'dialogueFinishedEvent'.
 * - Updates the watermark value. The watermark value indicates which activities have been 
 *   added since the chatbot activities were last called up. This ensures that only new 
 *   activities are requested from the chatbot.
 * - Saves the updated conversation state object in the session storage.
 * - Sets the state of the continueSurveytBtn (disabled vs. enabled).
 * 
 * @param {Array<{parameter: value}>} data - The data object containing the chatbot activities. 
 * @returns {void}
 */
function processActivities(data) {
  let state = loadConversationState();
  const newMessages = [];

  if (!state.processedActivities) {
    state.processedActivities = [];
  }
  toggleTypingIndicator('hide', typingAnimationDelay);

  data.activities.forEach(act => {
    if (act.type === 'message' && !state.processedActivities.includes(act.id)) {
      const from = (act.from.id === 'user1') ? 'user' : 'bot';
      if (from === 'bot') {
        addMessage(act.text, from);
        newMessages.push({ text: act.text, from, activityId: act.id, clientSideMsgId: null });
        state.processedActivities.push(act.id);
      } else {
        clientSideMsgId = sessionStorage.getItem('clientSideMsgId');
        saveConversationState(state);
        linkUserMessageWithActivityId(act.id, clientSideMsgId);
        state = loadConversationState();
      }
      if (act.channelData && act.channelData.finalState) {
        finalStateReached = true
        sessionStorage.setItem('finalStateReached', finalStateReached);
        document.dispatchEvent(new CustomEvent('dialogueFinishedEvent'));
      }
    }
  });

  pollInProgress = false;
  sessionStorage.setItem('pollInProgress', pollInProgress);

  if (data.watermark) {
    watermark = data.watermark;
  }
  state.watermark = watermark;
  state.conversationId = conversationId;

  state.messages = state.messages.concat(newMessages);
  saveConversationState(state);
  state.messages.forEach(msg => console.log(`Current state messages: ${msg.text}`)); //diese Zeile ist nur zum Testen in der Browser-Konsole
}

/**
 * Processes the initial bot welcome message when the chatbot is opened for the first time.
 * 
 * - This function acts as a buffer for the initial welcome message by the chatbot. The 
 *   chatbot's welcome message is retrieved from the server as soon as the user opens the 
 *   survey, however it is rendered only when the user opens the chatbot interface. 
 * - Receives the data object of the initial activity retrival.
 * - Keeps this data obejct until the user opens the chatbot interface for the first time. 
 * - When the user opens the chatbot interface for the first time: displays the initial bot 
 *   message typing animation (using the toggleTypingIndicator function) and executes the 
 *   processActivities(data) function to update the conversation state and display the initial 
 *   welcome message by the chatbot. 
 * 
 * @param {Array<{parameter: value}>} data - The data object containing the chatbot activities. 
 * @returns {void}
 */
function processInitialActivities(data) {
  chatbotAlreadyOpened = true
  sessionStorage.setItem('chatbotAlreadyOpened', chatbotAlreadyOpened);
  pollInProgress = true;
  sessionStorage.setItem('pollInProgress', pollInProgress);
  toggleTypingIndicator('show', initialTypingAnimationDelay);
  setTimeout(() => {processActivities(data)}, initialBotMessageDelay);
}

/**************************************************************************
 * User message processing
 **************************************************************************/

/**
 * Collects new user messages. 
 * 
 * - Deletes the user message from the user input field.
 * - Generates a clientSideMsgId variable for the user message. This variable
 *   is used as an identifier for the user message in the client side code. 
 * - Displays the new user messages in the dialogue space.
 * - Adds new user messages (without an activityId) to the conversation state. 
 * - Sets the state of the continueSurveytBtn (disabled vs. enabled).
 * - Calls the sendUserMessage function to request the server to send the new user 
 *   message to the chatbot. 
 * 
 * @async
 * @returns {void}
 */
async function collectUserMessage() {
  const input = document.getElementById('userInput');
  const text = input.value.trim();
  if (!text) return;
  input.value = ''; 

  clientSideMsgId = generateClientSideMsgId();

  addMessage(text, 'user');
  addMessageToState(text, 'user', null, clientSideMsgId); 
  sendUserMessage(text, clientSideMsgId);
}

/**
 * Generates an identifier value for user messages. 
 * 
 * - The identifier consists of the current time and a random number.
 * 
 * @returns {str} The identifier value.
 */
function generateClientSideMsgId() {
  return 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 100000);
}

/**
 * Sends a user message to the server. 
 * 
 * - Displays the chatbot typing animation in the dialogue space.
 * - If the variable sendInProgress is true (meaning there is still another user message 
 *   sending) or if the variable pollInProgress is true (meaning there is still a chatbot 
 *   activity retrieval process ongoing) this function is not executed. This is done to 
 *   ensure that new user messages are processed one by one and that a new user message 
 *   can only be sent to the server to be send to the chatbot when the client has received 
 *   and displayed the chatbot response to the previous user message. Any user message 
 *   created by the user in the meantime is displayed in the interface but not forwarded to
 *   the server and the chatbot and is therefore not answered. 
 * - Sets the sendInProgress variable to true at the start of the function and sets it to
 *   false when the server responded successfully. This is done to ensure that no other 
 *   sendUserMessageProcess can be started while the current sending process is ongoing. 
 * - Requests the server to send a new user message to the chatbot. Repeats this request
 *   until the server has sent a successfull response (to catch network errors). If an 
 *   error occurs, it is checked whether this error is a TypeError including the phrase
 *   "NetworkError". This is the case when the client was able to send the message to the 
 *   server, but the connection was lost before the server could send a successfull reply. 
 *   In this case, the loop is interrupted to prevent that the message is sent to the server
 *   a second time. Otherwise, when an error is caused by the fact that the connection was
 *   lost before the client could send the message to the server, the loop is continued to 
 *   retry sending the message to the server. 
 * - Retrieves the corresponding activityId assigned by the chatbot and adds it to the 
 *   conversation state using the linkLastUserMessageWithActivityId(activityId) function. 
 * - Calls the getActivities() function to receive the chatbot's response. 
 * 
 * @async
 * @param {str} text - The text of the user message to be sent. 
 * @returns {void}
 */
async function sendUserMessage(text, clientSideMsgId) {
  toggleTypingIndicator('show', typingAnimationDelay);
  if (sendInProgress) return;
  if (pollInProgress) return;
  sendInProgress = true;
  sessionStorage.setItem('sendInProgress', sendInProgress);
  sessionStorage.setItem('clientSideMsgId', clientSideMsgId);
  const treatmentGroup = sessionStorage.getItem('treatmentGroup');
  let activityId;

  while (true) {
    try{
      const res = await fetch('/sendmessage', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ conversationId, text, treatmentGroup, clientSideMsgId })
      });

      if (!res.ok) {
        throw new Error(`sendUserMessage() - HTTP error! status: ${res.status}`);
      }

      const respData = await res.json();

      if (respData.id) {
        activityId = respData.id;
        linkUserMessageWithActivityId(activityId, clientSideMsgId);
        break;
      }

      if (respData.status === 'in_progress') {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }

      throw new Error(`Unknown server response: ${JSON.stringify(respData)}`);

    } catch (error) {
      console.error('Error sending user message. Retrying.', error);
      await new Promise(r => setTimeout(r, 2000)); 
    }
  }
  sendInProgress = false;
  sessionStorage.setItem('sendInProgress', sendInProgress);
  getActivities();
}

/**
 * Adds a new message to the conversation state. 
 * 
 * - Retrieves the conversation state from the session storage.
 * - Adds the message to the conversation state object.
 * - Saves the updated conversation state object in the session storage. 
 * 
 * @param {string} text - The text of the message.
 * @param {string} from - The author of the message ('user' or 'bot').
 * @param {string} activityId - The activityId for the message, assigned by
 * the Microsoft Bot Framework.
 * @param {string} clientSideMsgId - The message identifier for client messages.
 * This value is null for bot messages. 
 * @returns {void}
 */
function addMessageToState(text, from, activityId, clientSideMsgId) {
  let state = loadConversationState();
  state.messages.push({ text, from, activityId, clientSideMsgId });
  saveConversationState(state);
}

/**
 * Adds the activityId of a user message to the conversation state. 
 * 
 * - Retrieves the conversation state from the session storage. 
 * - Adds the activityId of a user message identified by clientSideMsgId to this 
 *   message and the processedActivities array in the conversation state object. 
 * - Saves the updated conversation state object in the session storage. 
 * 
 * @param {string} activityId - The activityId to be added. 
 * @param {string} clientSideMsgId - The identifier of the user message to be 
 * connected with an activityId. 
 * @returns {void}
 */
function linkUserMessageWithActivityId(activityId, clientSideMsgId) {
  let state = loadConversationState();
  const message = state.messages.find(
    m => m.from === 'user' && m.clientSideMsgId === clientSideMsgId
  );
  if (message) {
    message.activityId = activityId;
    if (!state.processedActivities.includes(activityId)) {
      state.processedActivities.push(activityId);
    }
  }
  saveConversationState(state);
}

/**************************************************************************
 * Conversation state management
 **************************************************************************/

/**
 * Restores the saved conversation from the session storage.
 * 
 * - The purpose of this function is to retain the conversation if the page is accidentally 
 *   reloaded.
 * - This function is called as soon as the "surveyDataInitialized" is triggered if there is a 
 *   conversation stored in the session storage. 
 * - Retrieves the conversationId value and the latest stored watermark value.
 * - Restores all previously generated messages from the conversation.
 * 
 * @returns {void}
 */
function restoreConversation(storedConversation) {
  const conv = JSON.parse(storedConversation);
  conversationId = conv.conversationId;
  watermark = conv.watermark;
  conv.messages.forEach(msg => addMessage(msg.text, msg.from));
}

/**
 * Continues ongoing communication with the server regarding the chatbot api.
 * 
 * - The purpose of this function is to continue ongoing communication with the server
 *   regarding the communication with the chatbot api in case the page is reloaded. 
 * - If the startConvInProgress variable is true, meaning that the initialization of
 *   the conversation is still ongoing, the function startConversation is called. For 
 *   this, the startConvInProgress flag is temporarily set to false to enable the 
 *   startConversation function to be executed. 
 * - If the pollInProgress variable is true, meaning that there is an ongoing request
 *   to retrieve new activities from the api, the function getActivities is called. For 
 *   this, the pollInProgress flag is temporarily set to false to enable the 
 *   getActivities function to be executed. Additionally, shows the typing indicator. 
 * - If the sendInProgress variable is true, meaning that there is an ongoing request
 *   to send a new user message to the chatbot api, the text of this outstanding user
 *   message is retrieved from the conversationState and the stored clientSideMsgId of 
 *   this message, and the function sendUserMessage is called. For this, the 
 *   sendInProgress flag is temporarily set to false to enable the sendUserMessage 
 *   function to be executed. If the corresponding user message cannot be found in the 
 *   conversationState, the sendUserMessage function is not called and the sendInProgress
 *   flag is set to false to enable the processing of new user messages. 
 * 
 * @returns {void}
 */
function continueChatbotApiRequests() {
  if (startConvInProgress) {
    startConvInProgress = false;
    startConversation();
  }
  if (pollInProgress) {
    pollInProgress = false;
    toggleTypingIndicator('show', typingAnimationDelay);
    getActivities();
  } else if (sendInProgress) {
    let state = loadConversationState();
    clientSideMsgId = sessionStorage.getItem('clientSideMsgId');
    let message = state.messages.find(
      m => m.from === 'user' && m.clientSideMsgId === clientSideMsgId
    );
    if (message && message.from === 'user' && message.activityId === null) {
      let userMessageText = message.text;
      sendInProgress = false;
      sendUserMessage(userMessageText, clientSideMsgId);
    } else {
      sendInProgress = false;
      sessionStorage.setItem('sendInProgress', sendInProgress);
    }
  }
}

/**
 * Loads the stored conversation from the session storage.
 * 
 * @returns {{conversationId: string, 
 *            watermark: number, 
 *            messages: any[], 
 *            processedActivities: any[]}} The conversation state object. 
 */
function loadConversationState() {
  const stored = sessionStorage.getItem('conversation');
  return stored ? JSON.parse(stored) : { conversationId, watermark, messages: [], processedActivities: [] };
}

/**
 * Stores the conversation state object in the session storage. 
 * 
 * @param {{conversationId: string, 
*            watermark: number, 
*            messages: any[], 
*            processedActivities: any[]}} state - The conversation state object.
* @returns {void} 
*/
function saveConversationState(state) {
  sessionStorage.setItem('conversation', JSON.stringify(state));
}

/**************************************************************************
 * Chatbot interface
 **************************************************************************/

/**
 * Displays new messages in the chatbot interface.
 * 
 * - Creates a new html element with the message. 
 * - Scrolls to the bottom in the dialogue space. 
 * 
 * @param {string} text - The text of the message to be added. 
 * @param {string} from - The author of the message ("user1" vs. "Test_Chatbot_1"). // TODO: "user1" und "Test_Chatbot_1" noch korrigieren. 
 * @returns {void}
 */
function addMessage(text, from) {
  const messagesDiv = document.getElementById('messages');
  const msgDiv = document.createElement('div');
  msgDiv.classList.add('message', from === 'user' ? 'user-message' : 'bot-message');
  msgDiv.textContent = text;
  messagesDiv.appendChild(msgDiv);
  scrollMessagesToBottom();
}

/**
 * Toggles the chatbot typing indicator in the chatbot interface.
 * 
 * - If action is "show": Creates the html structure for the typing indicator (and deletes all 
 *   existing typing indicator html structures), and scrolls to the bottom of the messages area. 
 *   The creation of the html structure of the typing indicator is delayed by the value of 
 *   typingAnimationDelay.
 * - If action is "hide": removes the typing indicator from the messages area and removes the 
 *   timeout for a potentially queued typing indicator. 
 * 
 * @param {string} action - The action to perform: "show" vs. "hide".
 * @param {number} delay - Delay in milliseconds before showing the typing indicator.
 * @returns {void}
 */
function toggleTypingIndicator(action, delay) {
  const messagesDiv = document.getElementById('messages');
  let typingIndicator = document.getElementById('typingIndicator'); 

  // Logic to remove the typing indicator:
  if (action === 'hide') {
    if (typingIndicatorTimeout) {
      clearTimeout(typingIndicatorTimeout);
      typingIndicatorTimeout = null;
    }
    if (typingIndicator) {
      messagesDiv.removeChild(typingIndicator); 
    }
    return;
  }

  // Logic to show the typing indicator:
  if (action === 'show') {
    typingIndicatorTimeout = setTimeout(() => {
      if (typingIndicator) {
        messagesDiv.removeChild(typingIndicator);
      }

      typingIndicator = document.createElement('div');
      typingIndicator.id = 'typingIndicator';
      typingIndicator.classList.add('typing-indicator');
      typingIndicator.innerHTML = `
        <span class="dot"></span>
        <span class="dot"></span>
        <span class="dot"></span>
      `;
      messagesDiv.appendChild(typingIndicator);
      
      scrollMessagesToBottom();
      typingIndicatorTimeout = null;
    }, delay); 
  }
}

/**
 * Scrolls to the bottom in the dialogue space. 
 * 
 * - This function is called each time a new message is added to the chatbot interface.  
 * 
 * @returns {void}
 */
function scrollMessagesToBottom() {
  const messagesContainer = document.querySelector('.chatbot-messages-container');
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

/**
 * Dynamically adjusts the height of the user message input field. 
 * 
 * - This function is called each time the user interacts with the input field in the 
 *   chatbot interface. 
 * 
 * @param {HTMLTextAreaElement} textarea - The textarea html element. 
 * @param {number} maxRows - The maximum number of rows in the text input field. 
 * @returns {void}
 */
function adjustTextareaHeight(textarea, maxRows = 6) {
  textarea.style.height = 'auto';
  const scrollHeight = textarea.scrollHeight;
  const computedStyle = window.getComputedStyle(textarea);
  const lineHeight = parseInt(computedStyle.lineHeight);
  const paddingTop = parseInt(computedStyle.paddingTop);
  const paddingBottom = parseInt(computedStyle.paddingBottom);
  const borderTop = parseInt(computedStyle.borderTopWidth);
  const borderBottom = parseInt(computedStyle.borderBottomWidth);
  const totalVerticalPadding = paddingTop + paddingBottom + borderTop + borderBottom;
  const maxHeight = (lineHeight * maxRows) + totalVerticalPadding;

  //console.log(`scrollHeight: ${scrollHeight}`); // Nur zum Testen
  //console.log(`maxHeight: ${maxHeight}`); // Nur zum Testen

  if (scrollHeight <= maxHeight + 2) {
    textarea.style.overflowY = 'hidden'; //hidden
    textarea.style.height = scrollHeight + 'px';
  } else {
    textarea.style.overflowY = 'auto';
    textarea.style.height = maxHeight + 'px';
    textarea.scrollTop = textarea.scrollHeight;
  }

  scrollMessagesToBottom();
}
