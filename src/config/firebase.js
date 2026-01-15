/**
 * 🔥 Configuração Firebase
 * Gerencia conexão com Firestore para persistência de sessões
 */

const admin = require('firebase-admin');

let db = null;
let initialized = false;

function initializeFirebase() {
  if (initialized) return db;

  try {
    // Se já foi inicializado em outro lugar
    if (admin.apps.length > 0) {
      db = admin.firestore();
      initialized = true;
      console.log('✅ [Firebase] Usando instância existente');
      return db;
    }

    // Inicializar com variáveis de ambiente
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Variáveis Firebase não configuradas. Verifique .env');
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });

    // Usar o database 'kesher-db' ao invés do default
    const databaseId = process.env.FIREBASE_DATABASE_ID || 'kesher-db';
    db = admin.firestore();
    db.settings({ databaseId });
    
    initialized = true;
    console.log(`✅ [Firebase] Inicializado com sucesso (database: ${databaseId})`);
    return db;

  } catch (error) {
    console.error('❌ [Firebase] Erro ao inicializar:', error.message);
    throw error;
  }
}

function getDb() {
  if (!db) {
    initializeFirebase();
  }
  return db;
}

module.exports = { initializeFirebase, getDb, admin };
