import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';

const DB_FILENAME = 'finanzas.db';

/**
 * Exporta la base de datos actual como archivo de respaldo.
 *
 * 1. Lee el contenido del archivo .db actual en base64
 * 2. Crea un archivo de respaldo en caché con nombre con fecha
 * 3. Abre el menú de compartir del sistema
 *
 * @returns La ruta del archivo de respaldo creado
 */
export async function exportBackup(): Promise<string> {
  // Verificar que la BD existe usando la API de File
  const dbFile = new File(Paths.cache, DB_FILENAME);
  if (!dbFile.exists) {
    throw new Error('No se encontró la base de datos. ¿Has creado algún dato primero?');
  }

  // Crear nombre con fecha: finanzas-backup-2026-07-03.db
  const today = new Date().toISOString().split('T')[0];
  const backupName = `finanzas-backup-${today}.db`;

  // Crear archivo de respaldo en el directorio de documentos
  const backupFile = new File(Paths.cache, backupName);
  backupFile.create({ overwrite: true });

  // Leer el contenido de la BD en base64 y escribirlo en el respaldo
  const content = await dbFile.base64();
  backupFile.write(content, { encoding: 'base64' });

  return backupFile.uri;
}

/**
 * Comparte el archivo de respaldo usando el menú de compartir del sistema.
 * El usuario puede guardarlo en Google Drive, iCloud, enviarlo por email, etc.
 */
export async function shareBackup(): Promise<void> {
  const backupPath = await exportBackup();

  const isSharingAvailable = await Sharing.isAvailableAsync();
  if (!isSharingAvailable) {
    Alert.alert(
      'Respaldo creado',
      `El archivo se guardó en: ${backupPath}\n\nPuedes copiarlo manualmente desde allí.`
    );
    return;
  }

  await Sharing.shareAsync(backupPath, {
    mimeType: 'application/octet-stream',
    dialogTitle: 'Guardar respaldo de finanzas',
    UTI: 'public.data',
  });
}

/**
 * Importa un archivo de respaldo y reemplaza la base de datos actual.
 *
 * 1. Abre el selector de archivos del sistema
 * 2. El usuario selecciona un archivo .db
 * 3. Lee el contenido del respaldo en base64
 * 4. Reemplaza la BD actual con la del respaldo
 *
 * @returns true si la importación fue exitosa
 */
export async function importBackup(): Promise<boolean> {
  // Abrir selector de archivos
  const result = await DocumentPicker.getDocumentAsync({
    type: '*/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled) {
    return false;
  }

  const file = result.assets[0];
  if (!file?.uri) {
    throw new Error('No se seleccionó ningún archivo');
  }

  // Leer el contenido del archivo seleccionado en base64
  const selectedFile = new File(file.uri);
  if (!selectedFile.exists) {
    throw new Error('El archivo seleccionado no existe');
  }

  const content = await selectedFile.base64();

  // Hacer backup automático del archivo actual antes de reemplazar
  try {
    const currentFile = new File(Paths.cache, DB_FILENAME);
    if (currentFile.exists) {
      const currentContent = await currentFile.base64();
      const autoBackupFile = new File(Paths.cache, 'finanzas-auto-backup-before-import.db');
      autoBackupFile.create({ overwrite: true });
      autoBackupFile.write(currentContent, { encoding: 'base64' });
    }
  } catch {
    console.warn('No se pudo crear backup automático antes de importar');
  }

  // Reemplazar la BD actual con la del respaldo
  try {
    const dbFile = new File(Paths.cache, DB_FILENAME);
    if (dbFile.exists) {
      dbFile.delete();
    }

    // Escribir el nuevo contenido
    const newDbFile = new File(Paths.cache, DB_FILENAME);
    newDbFile.create({ overwrite: true });
    newDbFile.write(content, { encoding: 'base64' });

    return true;
  } catch (error) {
    // Si algo falla, restaurar el backup automático si existe
    try {
      const autoBackupFile = new File(Paths.cache, 'finanzas-auto-backup-before-import.db');
      if (autoBackupFile.exists) {
        const autoContent = await autoBackupFile.base64();
        const restoreFile = new File(Paths.cache, DB_FILENAME);
        restoreFile.create({ overwrite: true });
        restoreFile.write(autoContent, { encoding: 'base64' });
        autoBackupFile.delete();
      }
    } catch {
      console.error('Error crítico: no se pudo restaurar la BD después de importación fallida');
    }
    throw error;
  }
}

/**
 * Obtiene información sobre el último respaldo realizado.
 * Útil para mostrar en la pantalla de ajustes.
 */
export async function getLastBackupInfo(): Promise<{
  exists: boolean;
  fileName: string | null;
  fileSize: string | null;
  fileDate: string | null;
}> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const todayBackup = new File(Paths.cache, `finanzas-backup-${today}.db`);

    if (todayBackup.exists) {
      const size = todayBackup.size;
      return {
        exists: true,
        fileName: `finanzas-backup-${today}.db`,
        fileSize:
          size !== null && size !== undefined
            ? size > 1024 * 1024
              ? `${(size / (1024 * 1024)).toFixed(1)} MB`
              : `${(size / 1024).toFixed(0)} KB`
            : null,
        fileDate: today,
      };
    }

    return { exists: false, fileName: null, fileSize: null, fileDate: null };
  } catch {
    return { exists: false, fileName: null, fileSize: null, fileDate: null };
  }
}
