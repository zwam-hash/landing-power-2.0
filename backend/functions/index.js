import { onRequest } from "firebase-functions/v2/https";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

initializeApp();
const db = getFirestore();

export const ingestLead = onRequest({ cors: true }, async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { client_id, landing_id, session_id, name, email, phone, company, utm_source, utm_campaign } = req.body;

    if (!client_id || !landing_id || !email) {
      return res.status(400).json({ error: "Faltan parámetros obligatorios: client_id, landing_id, email" });
    }

    // --- CIRCUIT BREAKER: Validación de Cliente y Landing ---
    const clientRef = db.collection("clients").doc(client_id);
    const landingRef = db.collection("landings").doc(landing_id);

    const [clientSnap, landingSnap] = await Promise.all([clientRef.get(), landingRef.get()]);

    if (!clientSnap.exists || clientSnap.data().contract_status !== "active") {
      return res.status(403).json({ 
        error: "Circuit Breaker: Cuenta de cliente inactiva o suspendida.",
        code: "CLIENT_SUSPENDED" 
      });
    }

    if (!landingSnap.exists || landingSnap.data().status !== "active") {
      return res.status(403).json({ 
        error: "Circuit Breaker: Landing page desactivada.",
        code: "LANDING_INACTIVE" 
      });
    }

    // --- INGESTIÓN Y NORMALIZACIÓN DE DATOS ---
    const leadRef = db.collection("leads").doc();
    const newLead = {
      lead_id: leadRef.id,
      client_id,
      landing_id,
      session_id: session_id || null,
      name: name || "",
      email: email.toLowerCase().trim(),
      phone: phone || "",
      company: company || "",
      score: 0,
      quality: "UNPROCESSED",
      status: "new",
      capi_status: "pending",
      created_at: Timestamp.now(),
      utm_data: {
        source: utm_source || "direct",
        campaign: utm_campaign || "none"
      }
    };

    await leadRef.set(newLead);

    return res.status(201).json({
      success: true,
      message: "Lead registrado exitosamente",
      lead_id: leadRef.id
    });

  } catch (error) {
    console.error("Error en ingestLead:", error);
    return res.status(500).json({ error: "Error interno procesando la petición" });
  }
});
