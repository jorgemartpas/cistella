export type Faq = { q: string; a: string };

/** Preguntas de la portada pública */
export const PUBLIC_FAQS: Faq[] = [
  {
    q: "¿Cuánto cuesta?",
    a: "Depende del plan que elijas (mira «Planes»), con IVA incluido. Los productos se pagan aparte, en cada reparto y con el peso real, a la misma tarjeta.",
  },
  {
    q: "¿Qué días repartís?",
    a: "Martes y viernes. Puedes cambiar tu cesta y confirmar el pedido hasta las 20:00 del día anterior. Eliges si quieres reparto los dos días, uno a la semana, cada dos semanas o solo cuando lo pidas.",
  },
  {
    q: "¿Dónde repartís?",
    a: "De momento solo en Alzira (código postal 46600).",
  },
  {
    q: "¿Puedo cambiar de plan o darme de baja?",
    a: "Sí, desde tu cuenta, cuando quieras y sin permanencia.",
  },
];

/** Preguntas frecuentes de la cuenta del cliente */
export const CUSTOMER_FAQS: Faq[] = [
  {
    q: "¿Tengo que confirmar cada pedido?",
    a: "Sí. Tu cesta se guarda, pero cada reparto solo se prepara si pulsas «Confirmar pedido» antes del cierre (las 20:00 del día anterior). Después de confirmar puedes seguir cambiándola hasta esa hora.",
  },
  {
    q: "¿Por qué el importe es «estimado»?",
    a: "La carne, el pescado y buena parte de la fruta van al peso. Cada tienda pesa lo que te prepara y se cobra el peso real cuando te lo entregamos.",
  },
  {
    q: "¿Puedo pedir un peso exacto?",
    a: "Sí. En tu cesta, pulsa sobre la cantidad (por ejemplo «0,5 kg») y escribe la que quieras, como «0,3».",
  },
  {
    q: "¿Qué diferencia hay entre una lista y una cesta guardada?",
    a: "Una lista es un grupo de productos que quieres tener a mano (se guardan con el marcador de su foto) y puedes añadirlos a tu cesta cuando quieras. Una cesta guardada es una cesta completa, con sus cantidades, para volver a usarla de golpe.",
  },
  {
    q: "¿Qué pasa si una tienda no tiene un producto?",
    a: "La fruta, la verdura y el pescado los sirve la tienda de turno de cada reparto. Si no tiene algo, ese producto no va ese día y no se te cobra; lo verás en tu pedido.",
  },
  {
    q: "¿Y si no estoy en casa?",
    a: "Si no te encontramos, ese pedido no se cobra. Escríbenos y buscamos una solución.",
  },
  ...PUBLIC_FAQS.slice(1),
];
