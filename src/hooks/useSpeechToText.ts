import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

/**
 * Opciones del hook de dictado.
 */
export interface UseSpeechToTextOptions {
  /** Idioma del reconocimiento, por defecto espanol de Venezuela. */
  lang?: string;
  /**
   * Se invoca cada vez que el motor de voz emite texto.
   * `isFinal` indica si el resultado es definitivo o interino.
   */
  onTranscript?: (text: string, isFinal: boolean) => void;
  /** Se invoca con un mensaje listo para mostrar al usuario. */
  onError?: (message: string) => void;
}

export interface UseSpeechToTextResult {
  /** Hay una sesion de dictado activa. */
  isListening: boolean;
  /** El motor de reconocimiento esta disponible en este dispositivo. */
  isAvailable: boolean;
  /** Solicita permisos y arranca el dictado. */
  start: () => Promise<void>;
  /** Detiene el dictado de forma ordenada. */
  stop: () => Promise<void>;
  /** Alterna entre escuchar y detenerse. */
  toggle: () => void;
}

function describeError(errorCode: string | undefined): string {
  switch (errorCode) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'No hay permiso para usar el microfono. Activalo en Ajustes del sistema.';
    case 'no-speech':
      return 'No escuche nada. Acercate al microfono e intenta de nuevo.';
    case 'audio-capture':
      return 'No se encontro un microfono disponible.';
    case 'network':
      return 'El reconocimiento necesita conexion a internet en este dispositivo.';
    case 'aborted':
      return 'El dictado se interrumpio.';
    default:
      return 'No se pudo reconocer tu voz. Intenta de nuevo.';
  }
}

/**
 * Encapsula expo-speech-recognition: permisos, arranque, parada y
 * los eventos de resultado/error/fin. Mantiene el estado `isListening`
 * sincronizado para poder pintar el boton de microfono.
 */
export function useSpeechToText(
  options: UseSpeechToTextOptions = {}
): UseSpeechToTextResult {
  const { lang = 'es-VE' } = options;

  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(true);

  // Refs para evitar closures obsoletos en los eventos.
  const onTranscriptRef = useRef(options.onTranscript);
  const onErrorRef = useRef(options.onError);

  useEffect(() => {
    onTranscriptRef.current = options.onTranscript;
  }, [options.onTranscript]);

  useEffect(() => {
    onErrorRef.current = options.onError;
  }, [options.onError]);

  useEffect(() => {
    try {
      setIsAvailable(
        ExpoSpeechRecognitionModule.isRecognitionAvailable() ?? true
      );
    } catch {
      setIsAvailable(true);
    }
  }, []);

  useSpeechRecognitionEvent('start', () => {
    setIsListening(true);
  });

  useSpeechRecognitionEvent('end', () => {
    setIsListening(false);
  });

  useSpeechRecognitionEvent('result', (event: any) => {
    const transcript: string = event?.results?.[0]?.transcript ?? '';
    if (transcript) {
      onTranscriptRef.current?.(transcript, Boolean(event?.isFinal));
    }
  });

  useSpeechRecognitionEvent('error', (event: any) => {
    setIsListening(false);
    onErrorRef.current?.(describeError(event?.error));
  });

  const start = useCallback(async () => {
    try {
      const permission =
        await ExpoSpeechRecognitionModule.requestPermissionsAsync();

      if (!permission?.granted) {
        onErrorRef.current?.(
          'Para dictar necesitamos permiso de microfono y reconocimiento de voz.'
        );
        return;
      }

      await ExpoSpeechRecognitionModule.start({
        lang,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        addsPunctuation: true,
      });
      setIsListening(true);
    } catch {
      setIsListening(false);
      onErrorRef.current?.('No se pudo iniciar el reconocimiento de voz.');
    }
  }, [lang]);

  const stop = useCallback(async () => {
    try {
      await ExpoSpeechRecognitionModule.stop();
    } catch {
      // Ignoramos errores al detener: el evento `end` limpia el estado.
    }
    setIsListening(false);
  }, []);

  const toggle = useCallback(() => {
    if (isListening) {
      void stop();
    } else {
      void start();
    }
  }, [isListening, start, stop]);

  return { isListening, isAvailable, start, stop, toggle };
}

export default useSpeechToText;
