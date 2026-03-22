/**
 * Audio Recording & Transcription module
 */
import State from './state.js';
import * as api from './api.js';
import * as ui from './ui.js';

export const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        State.mediaRecorder = new MediaRecorder(stream);
        State.audioChunks = [];

        State.mediaRecorder.ondataavailable = (event) => {
            State.audioChunks.push(event.data);
        };

        State.mediaRecorder.onstop = async () => {
            State.audioBlob = new Blob(State.audioChunks, { type: 'audio/webm' });
            const audioUrl = URL.createObjectURL(State.audioBlob);
            const playback = document.getElementById('audio-playback');
            if (playback) {
                playback.src = audioUrl;
                playback.style.display = 'block';
            }
        };

        State.mediaRecorder.start();
        State.secondsRecorded = 0;
        State.timerInterval = setInterval(() => {
            State.secondsRecorded++;
            ui.updateTimer(State.secondsRecorded);
        }, 1000);

        ui.showNotification('Запись началась', 'info');
    } catch (err) {
        console.error('Failed to start recording:', err);
        ui.showNotification('Не удалось получить доступ к микрофону', 'error');
    }
};

export const stopRecording = () => {
    if (State.mediaRecorder && State.mediaRecorder.state !== 'inactive') {
        State.mediaRecorder.stop();
        clearInterval(State.timerInterval);
        ui.showNotification('Запись остановлена', 'success');
    }
};

export const processAudio = async () => {
    if (!State.audioBlob) {
        ui.showNotification('Сначала запишите аудио', 'error');
        return;
    }

    ui.toggleLoading('process-btn', true, 'Транскрибация...');
    try {
        const result = await api.transcribeAudio(State.audioBlob);
        const transcriptArea = document.getElementById('transcription-display');
        if (transcriptArea) {
            transcriptArea.textContent = result.text;
        }
        ui.showNotification('Транскрибация успешно завершена');
    } catch (err) {
        console.error('Transcription error:', err);
        ui.showNotification('Ошибка при транскрибации', 'error');
    } finally {
        ui.toggleLoading('process-btn', false);
    }
};
