import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Carga diferida de expo-speech-recognition.
 *
 * El paquete ejecuta `requireNativeModule("ExpoSpeechRecognition")` en tiempo
 * de evaluacion del modulo. Si el modulo nativo no esta registrado en el build
 * (por ejemplo, por un desajuste de version con SDK 54), esa llamada lanza una
 * excepcion que tumba la pantalla que importe el paquete. Por eso lo cargamos
 * con `require` dentro de try/catch, igual que en useSettings.ts.
 *
 * `typeof import(...)` es solo un tipo: no genera codigo en runtime.
 */
type SpeechRecognitionPackage = typeof import('expo-speech-recognition');

let speechPackageLoaded = false;
let speechPackage: SpeechRecognitionPackage | null = null;

function loadSpeechPackage(): SpeechRecognitionPackage | null {
  if (speechPackageLoaded) {
    return speechPackage;
  }
  speechPackageLoaded = true;
  try {
    speechPackage = require('expo-speech-recognition') as SpeechRecognitionPackage;
  } catch (error) {
    console.warn(
      '[useSpeechToText] El modulo nativo de reconocimiento de voz no esta disponible en este build.',
      error
    );
    speechPackage = null;
  }
  return speechPackage;
}

type SpeechSubscription = { remove: () => void };

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
 *
 * Es tolerante a fallos: si el modulo nativo no esta disponible, el hook
 * sigue funcionando en modo degradado (`isAvailable === false`) y nunca
 * lanza una excepcion durante el render.
 */
export function useSpeechToText(
  options: UseSpeechToTextOptions = {}
): UseSpeechToTextResult {
  const { lang = 'es-VE' } = options;

  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);

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
    const pkg = loadSpeechPackage();
    if (!pkg) {
      setIsAvailable(false);
      return;
    }

    const module = pkg.ExpoSpeechRecognitionModule;
    if (!module) {
      setIsAvailable(false);
      return;
    }

    try {
      setIsAvailable(module.isRecognitionAvailable() ?? true);
    } catch {
      // Algunos motores lanzan si se consulta antes de inicializar;
      // preferimos intentar el dictado antes que deshabilitarlo.
      setIsAvailable(true);
    }

    const subscriptions: SpeechSubscription[] = [];

    try {
      subscriptions.push(
        module.addListener('start', () => {
          setIsListening(true);
        })
      );

      subscriptions.push(
        module.addListener('end', () => {
          setIsListening(false);
        })
      );

      subscriptions.push(
        module.addListener('result', (event) => {
          const transcript: string = event?.results?.[0]?.transcript ?? '';
          if (transcript) {
            onTranscriptRef.current?.(transcript, Boolean(event?.isFinal));
          }
        })
      );

      subscriptions.push(
        module.addListener('error', (event) => {
          setIsListening(false);
          onErrorRef.current?.(describeError(event?.error));
        })
      );
    } catch (error) {
      console.warn(
        '[useSpeechToText] No se pudieron registrar los eventos de voz.',
        error
      );
    }

    return () => {
      subscriptions.forEach((subscription) => {
        try {
          subscription.remove();
        } catch {
          // Ignoramos errores al desuscribirnos durante el desmontaje.
        }
      });
    };
  }, []);

  const start = useCallback(async () => {
    const module = loadSpeechPackage()?.ExpoSpeechRecognitionModule;
    if (!module) {
      onErrorRef.current?.(
        'El dictado por voz no esta disponible en esta version de la app.'
      );
      return;
    }

    try {
      const permission = await module.requestPermissionsAsync();

      if (!permission?.granted) {
        onErrorRef.current?.(
          'Para dictar necesitamos permiso de microfono y reconocimiento de voz.'
        );
        return;
      }

      module.start({
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
    const module = loadSpeechPackage()?.ExpoSpeechRecognitionModule;
    try {
      module?.stop();
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
