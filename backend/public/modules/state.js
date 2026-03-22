/**
 * Centralized State Management for BizMap AI
 */
const State = {
    csrfToken: null,
    mediaRecorder: null,
    audioChunks: [],
    audioBlob: null,
    rerecordCount: 0,
    suggestions: [],
    currentDiagramScale: 1,
    timerInterval: null,
    secondsRecorded: 0,
    transcriptionTimerInterval: null,
    sessionUser: null,
    selectedDepartment: null,
    chatId: null,
    chatVersions: [],
    isPreviewMode: false,
    bpmnScriptsLoaded: false,
    bpmnViewer: null,
    bpmnModeler: null,

    // Helper to reset chat-specific state
    resetChatState() {
        this.chatId = null;
        this.chatVersions = [];
        this.audioChunks = [];
        this.audioBlob = null;
        this.suggestions = [];
    }
};

export default State;
