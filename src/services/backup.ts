import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import { Alert } from 'react-native';
import { closeDatabase, getDatabase } from './database';

const AUTO_BACKUP_FILENAME = 'finanzas-auto-backup-before-import.db';

/**
 * Devuelve el archivo real de la base de datos.
 *
 * expo-sqlite abre la base en su directorio por defecto
 * (Documents/SQLite en iOS, databases/ en Android), NO en Paths.cache.
 * Por eso se consulta `databasePath` en lugar de asumir una carpeta.
 */
async function getDatabaseFile(): Promise<File> {
  const db = await getDatabase();
  const path = db.databasePath;

  if (!path) {
    throw new Error('No se pudo determinar la ruta de la base de datos');
  }

  return new File(path);
}

/**
 * Vuelca el journal WAL al archivo principal antes de copiarlo.
 * Sin esto, las últimas escrituras podrían quedar fuera del respaldo.
 */
async function checkpointWal(): Promise<void> {
  try {
    const db = await getDatabase();
    await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
  } catch {
    // Si la BD no usa WAL el checkpoint no aplica y la copia sigue siendo válida.
  }
}

/**
 * Elimina los archivos auxiliares de SQLite (-wal, -shm, -journal).
 * Si se quedan junto a un archivo .db recién restaurado, SQLite intenta
 * reproducirlos y puede corromper la base importada.
 */
function deleteSidecarFiles(dbPath: string): void {
  for (const suffix of ['-wal', '-shm', '-journal']) {
    try {
      const sidecar = new File(`${dbPath}${suffix}`);
      if (sidecar.exists) {
        sidecar.delete();
      }
    } catch {
      // No es fatal: el archivo puede no existir o estar ya liberado.
    }
  }
}

/**
 * Exporta la base de datos actual como archivo de respaldo.
 *
 * 1. Vuelca el journal y localiza el archivo .db real
 * 2. Lee su contenido en base64
 * 3. Crea un archivo de respaldo en caché con nombre con fecha
 *
 * @returns La ruta del archivo de respaldo creado
 */
export async function exportBackup(): Promise<string> {
  await checkpointWal();

  const dbFile = await getDatabaseFile();
  if (!dbFile.exists) {
    throw new Error('No se encontró la base de datos. ¿Has creado algún dato primero?');
  }

  // Crear nombre con fecha: finanzas-backup-2026-07-03.db
  const today = new Date().toISOString().split('T')[0];
  const backupName = `finanzas-backup-${today}.db`;

  // Crear archivo de respaldo en el directorio de caché
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
 * 2. Lee el respaldo seleccionado en base64
 * 3. Guarda un respaldo automático del estado actual
 * 4. Cierra SQLite, borra el .db (y sus auxiliares) y escribe el respaldo
 * 5. Reabre la base y verifica que es utilizable
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

  await checkpointWal();
  const dbFile = await getDatabaseFile();
  const dbPath = dbFile.uri;

  // Hacer backup automático del archivo actual antes de reemplazar
  if (dbFile.exists) {
    try {
      const currentContent = await dbFile.base64();
      const autoBackupFile = new File(Paths.cache, AUTO_BACKUP_FILENAME);
      autoBackupFile.create({ overwrite: true });
      autoBackupFile.write(currentContent, { encoding: 'base64' });
    } catch {
      console.warn('No se pudo crear backup automático antes de importar');
    }
  }

  // Reemplazar la BD actual con la del respaldo
  try {
    // Cerrar la conexión: con handles abiertos el archivo no se puede
    // reemplazar de forma fiable (y en iOS el archivo sigue mapeado).
    await closeDatabase();

    deleteSidecarFiles(dbPath);

    const target = new File(dbPath);
    if (target.exists) {
      target.delete();
    }

    // Escribir el nuevo contenido
    target.create({ overwrite: true });
    target.write(content, { encoding: 'base64' });

    // Reabrir y verificar que la BD restaurada responde
    const db = await getDatabase();
    await db.getFirstAsync('SELECT 1');

    return true;
  } catch (error) {
    // Si algo falla, restaurar el backup automático si existe
    try {
      const autoBackupFile = new File(Paths.cache, AUTO_BACKUP_FILENAME);
      if (autoBackupFile.exists) {
        const autoContent = await autoBackupFile.base64();

        deleteSidecarFiles(dbPath);

        const restoreFile = new File(dbPath);
        if (restoreFile.exists) {
          restoreFile.delete();
        }
        restoreFile.create({ overwrite: true });
        restoreFile.write(autoContent, { encoding: 'base64' });
        autoBackupFile.delete();
      }
    } catch {
      console.error('Error crítico: no se pudo restaurar la BD después de importación fallida');
    }

    // Dejar la app con una conexión válida en cualquier caso
    try {
      await getDatabase();
    } catch {
      // Si tampoco se puede reabrir, el error original es más informativo
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
