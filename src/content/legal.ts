/**
 * Legal pages: privacy notice, terms and imprint, in the three site locales.
 *
 * Kept as data instead of message-catalogue keys because these are long
 * documents that change as a block, per jurisdiction, and would drown the UI
 * strings in messages/*.json.
 *
 * Every factual claim here was checked against the running system:
 *   - documents are sent to Anthropic for extraction (src/lib/actions/ai.ts)
 *   - data lives in Supabase, project region eu-central-2 (Zurich)
 *   - hosting and rendering on Vercel, region fra1 (Frankfurt) per vercel.json
 *
 * TODO (owner): add the full postal address in `imprint.address`. An EU-facing
 * imprint needs a geographic address, not only an email. Keep this reviewed by
 * a professional before relying on it.
 */

export interface LegalSection {
  heading: string
  paragraphs: string[]
  bullets?: string[]
}

export interface LegalDocument {
  title: string
  updated: string
  intro: string
  sections: LegalSection[]
}

export interface LegalContent {
  privacy: LegalDocument
  terms: LegalDocument
  imprint: LegalDocument
}

const UPDATED = '2026-09-27'

const OPERATOR = 'Vidal Reñao'
const CITY = 'Basel, Switzerland'
const EMAIL = 'vidalrenao.lab@outlook.com'

export const LEGAL = {
  es: {
    privacy: {
      title: 'Política de privacidad',
      updated: UPDATED,
      intro:
        'Esta política explica qué datos trata Invoice Auto, con qué finalidad, dónde se almacenan y qué derechos tienes. Está escrita para que se entienda, no para cubrirnos las espaldas.',
      sections: [
        {
          heading: 'Quién trata tus datos',
          paragraphs: [
            `Invoice Auto es un servicio operado por ${OPERATOR}, ${CITY}. Para cualquier asunto relacionado con datos personales: ${EMAIL}.`,
          ],
        },
        {
          heading: 'Qué datos tratamos',
          paragraphs: ['Solo lo necesario para prestar el servicio:'],
          bullets: [
            'Datos de cuenta: nombre, correo electrónico y contraseña cifrada.',
            'Documentos que subes: tickets y facturas, con los datos que contienen (proveedor, importes, IVA, IBAN y referencia de pago cuando aparecen impresos).',
            'Datos de uso técnico: registros del servidor necesarios para operar y proteger el servicio.',
          ],
        },
        {
          heading: 'Para qué los usamos',
          paragraphs: [
            'Para extraer automáticamente los datos de los documentos que subes, mostrártelos, permitirte revisarlos y exportarlos, y para decidir y preparar ficheros de pago cuando usas esa función. La base jurídica es la ejecución del contrato que aceptas al crear una cuenta.',
            'No vendemos datos, no los cedemos con fines publicitarios y no los usamos para entrenar modelos de inteligencia artificial.',
          ],
        },
        {
          heading: 'Con quién los compartimos',
          paragraphs: ['Trabajamos con tres proveedores, todos como encargados del tratamiento:'],
          bullets: [
            'Anthropic (Claude Vision): recibe el documento que subes para extraer sus datos. Es el único destinatario del contenido del documento.',
            'Supabase: base de datos y almacenamiento de ficheros, en su región eu-central-2 (Zúrich, Suiza).',
            'Vercel: alojamiento y renderizado de la aplicación, configurado en la región fra1 (Fráncfort, Alemania).',
          ],
        },
        {
          heading: 'Dónde se guardan',
          paragraphs: [
            'Tus documentos y los datos extraídos se almacenan en Suiza (Supabase, eu-central-2). La aplicación se ejecuta en Alemania (Vercel, fra1). El tratamiento con Claude Vision puede implicar transferencia internacional a Estados Unidos, amparada en las cláusulas contractuales tipo del proveedor.',
          ],
        },
        {
          heading: 'Cuánto tiempo',
          paragraphs: [
            'Mientras tu cuenta siga activa. Puedes borrar documentos individualmente en cualquier momento, y solicitar la eliminación completa de la cuenta escribiendo a la dirección de contacto. El registro de auditoría de pagos es inmutable por diseño: no se modifica ni se borra, porque su valor depende de eso.',
          ],
        },
        {
          heading: 'Tus derechos',
          paragraphs: [
            'Puedes pedir acceso, rectificación, supresión, limitación, portabilidad u oposición escribiendo a la dirección de contacto. Si resides en la UE puedes reclamar ante tu autoridad de protección de datos; si resides en Suiza, ante el PFPDT.',
          ],
        },
        {
          heading: 'Cookies',
          paragraphs: [
            'Usamos únicamente cookies técnicas: una para recordar tu idioma y las necesarias para mantener tu sesión iniciada. No usamos cookies publicitarias ni de seguimiento de terceros. Nuestra analítica de uso es agregada y sin cookies.',
          ],
        },
      ],
    },
    terms: {
      title: 'Términos de servicio',
      updated: UPDATED,
      intro: 'Las condiciones de uso de Invoice Auto. En corto: úsalo con cabeza y revisa lo que la IA extrae.',
      sections: [
        {
          heading: 'El servicio',
          paragraphs: [
            'Invoice Auto digitaliza tickets y facturas mediante inteligencia artificial, calcula el IVA aplicable en las jurisdicciones que soporta y prepara ficheros de pago SEPA e ISO 20022 pain.001.',
          ],
        },
        {
          heading: 'Fase beta',
          paragraphs: [
            'El servicio se encuentra en fase beta y se presta de forma gratuita. No hay acuerdo de nivel de servicio: puede haber interrupciones, y las funcionalidades pueden cambiar. Avisaremos con antelación razonable antes de introducir un precio.',
          ],
        },
        {
          heading: 'Tu responsabilidad',
          paragraphs: [
            'La extracción automática puede equivocarse. Debes revisar los datos antes de usarlos para declarar impuestos o para ordenar un pago. Invoice Auto es una herramienta de apoyo, no un asesor fiscal ni contable, y no sustituye la revisión de un profesional.',
            'Eres responsable de tener derecho a subir los documentos que subes y de la exactitud de lo que apruebas.',
          ],
        },
        {
          heading: 'Pagos',
          paragraphs: [
            'La función de pagos genera ficheros para que tú los envíes a tu banco. Invoice Auto no mueve dinero, no accede a tus cuentas bancarias y no ejecuta transferencias. La orden final siempre la das tú, en tu banco.',
          ],
        },
        {
          heading: 'Límites de responsabilidad',
          paragraphs: [
            'Dentro de lo que permite la ley aplicable, la responsabilidad se limita a los daños causados por dolo o negligencia grave. No respondemos de sanciones fiscales, pagos erróneos ni pérdidas derivadas de datos que hayas aprobado sin revisar.',
          ],
        },
        {
          heading: 'Ley aplicable',
          paragraphs: [
            'Se aplica el derecho suizo, con foro en Basilea, sin perjuicio de los derechos imperativos que te correspondan como consumidor en tu país de residencia.',
          ],
        },
      ],
    },
    imprint: {
      title: 'Aviso legal',
      updated: UPDATED,
      intro: 'Identificación del responsable del sitio.',
      sections: [
        {
          heading: 'Responsable',
          paragraphs: [`${OPERATOR}`, `${CITY}`, `Correo: ${EMAIL}`],
        },
        {
          heading: 'Objeto',
          paragraphs: [
            'Invoice Auto es un servicio de digitalización de facturas y tickets con inteligencia artificial, dirigido a autónomos y pequeñas empresas.',
          ],
        },
        {
          heading: 'Propiedad intelectual',
          paragraphs: [
            'El contenido y el código de este sitio pertenecen a su titular. Las marcas de terceros mencionadas pertenecen a sus respectivos propietarios.',
          ],
        },
      ],
    },
  },

  de: {
    privacy: {
      title: 'Datenschutzerklärung',
      updated: UPDATED,
      intro:
        'Diese Erklärung beschreibt, welche Daten Invoice Auto bearbeitet, wozu, wo sie gespeichert werden und welche Rechte du hast.',
      sections: [
        {
          heading: 'Verantwortlich',
          paragraphs: [
            `Invoice Auto wird betrieben von ${OPERATOR}, ${CITY}. Für Anliegen zum Datenschutz: ${EMAIL}.`,
          ],
        },
        {
          heading: 'Welche Daten',
          paragraphs: ['Nur, was für den Betrieb nötig ist:'],
          bullets: [
            'Kontodaten: Name, E-Mail-Adresse und verschlüsseltes Passwort.',
            'Hochgeladene Dokumente: Belege und Rechnungen samt deren Inhalt (Lieferant, Beträge, MWST, IBAN und Zahlungsreferenz, sofern aufgedruckt).',
            'Technische Protokolldaten für Betrieb und Sicherheit.',
          ],
        },
        {
          heading: 'Wozu',
          paragraphs: [
            'Zur automatischen Erfassung deiner Dokumente, zur Anzeige, Prüfung und zum Export, sowie zur Entscheidung und Erstellung von Zahlungsdateien, wenn du diese Funktion nutzt. Rechtsgrundlage ist die Vertragserfüllung.',
            'Wir verkaufen keine Daten, geben sie nicht für Werbezwecke weiter und trainieren damit keine KI-Modelle.',
          ],
        },
        {
          heading: 'Auftragsbearbeiter',
          paragraphs: ['Drei Anbieter, alle als Auftragsbearbeiter:'],
          bullets: [
            'Anthropic (Claude Vision): erhält das hochgeladene Dokument zur Datenerfassung.',
            'Supabase: Datenbank und Dateispeicher, Region eu-central-2 (Zürich, Schweiz).',
            'Vercel: Hosting und Rendering, Region fra1 (Frankfurt, Deutschland).',
          ],
        },
        {
          heading: 'Speicherort',
          paragraphs: [
            'Dokumente und erfasste Daten liegen in der Schweiz (Supabase, eu-central-2). Die Anwendung läuft in Deutschland (Vercel, fra1). Die Erfassung durch Claude Vision kann eine Übermittlung in die USA bedeuten, gestützt auf die Standardvertragsklauseln des Anbieters.',
          ],
        },
        {
          heading: 'Dauer',
          paragraphs: [
            'Solange dein Konto besteht. Einzelne Dokumente kannst du jederzeit löschen; die vollständige Löschung des Kontos erfolgt auf Anfrage. Das Audit-Log der Zahlungen ist bewusst unveränderlich und wird weder geändert noch gelöscht.',
          ],
        },
        {
          heading: 'Deine Rechte',
          paragraphs: [
            'Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch — per E-Mail an die Kontaktadresse. Beschwerdestelle in der Schweiz: EDÖB; in der EU: deine zuständige Datenschutzbehörde.',
          ],
        },
        {
          heading: 'Cookies',
          paragraphs: [
            'Nur technische Cookies: eines für die Sprachwahl und die für die Anmeldung notwendigen. Keine Werbe- oder Tracking-Cookies Dritter. Unsere Nutzungsstatistik ist aggregiert und cookiefrei.',
          ],
        },
      ],
    },
    terms: {
      title: 'Nutzungsbedingungen',
      updated: UPDATED,
      intro: 'Die Bedingungen für die Nutzung von Invoice Auto. Kurz: mit Verstand nutzen und die Erfassung prüfen.',
      sections: [
        {
          heading: 'Leistung',
          paragraphs: [
            'Invoice Auto erfasst Belege und Rechnungen mit künstlicher Intelligenz, berechnet die MWST in den unterstützten Ländern und erstellt Zahlungsdateien nach SEPA und ISO 20022 pain.001.',
          ],
        },
        {
          heading: 'Beta-Phase',
          paragraphs: [
            'Der Dienst befindet sich in der Beta-Phase und ist kostenlos. Es gibt keine Verfügbarkeitszusage; Funktionen können sich ändern. Vor der Einführung eines Preises informieren wir rechtzeitig.',
          ],
        },
        {
          heading: 'Deine Verantwortung',
          paragraphs: [
            'Die automatische Erfassung kann Fehler enthalten. Prüfe die Daten, bevor du sie für Steuererklärungen oder Zahlungen verwendest. Invoice Auto ist ein Hilfsmittel und ersetzt weder Treuhänder noch Steuerberatung.',
            'Du bist dafür verantwortlich, dass du die hochgeladenen Dokumente verwenden darfst.',
          ],
        },
        {
          heading: 'Zahlungen',
          paragraphs: [
            'Die Zahlungsfunktion erzeugt Dateien, die du selbst bei deiner Bank einreichst. Invoice Auto bewegt kein Geld, hat keinen Zugriff auf deine Bankkonten und führt keine Überweisungen aus.',
          ],
        },
        {
          heading: 'Haftung',
          paragraphs: [
            'Soweit gesetzlich zulässig, beschränkt sich die Haftung auf Vorsatz und grobe Fahrlässigkeit. Keine Haftung für Steuerbussen, Fehlzahlungen oder Schäden aus ungeprüft freigegebenen Daten.',
          ],
        },
        {
          heading: 'Anwendbares Recht',
          paragraphs: [
            'Es gilt Schweizer Recht, Gerichtsstand Basel, vorbehaltlich zwingender Konsumentenrechte deines Wohnsitzlandes.',
          ],
        },
      ],
    },
    imprint: {
      title: 'Impressum',
      updated: UPDATED,
      intro: 'Angaben zum Betreiber dieser Website.',
      sections: [
        { heading: 'Betreiber', paragraphs: [`${OPERATOR}`, `${CITY}`, `E-Mail: ${EMAIL}`] },
        {
          heading: 'Zweck',
          paragraphs: [
            'Invoice Auto ist ein Dienst zur KI-gestützten Erfassung von Belegen und Rechnungen für Selbstständige und KMU.',
          ],
        },
        {
          heading: 'Urheberrecht',
          paragraphs: [
            'Inhalt und Code dieser Website gehören dem Betreiber. Genannte Marken Dritter gehören ihren jeweiligen Inhabern.',
          ],
        },
      ],
    },
  },

  en: {
    privacy: {
      title: 'Privacy policy',
      updated: UPDATED,
      intro:
        'What Invoice Auto does with your data, why, where it is stored and what you can ask for. Written to be understood.',
      sections: [
        {
          heading: 'Who is responsible',
          paragraphs: [
            `Invoice Auto is operated by ${OPERATOR}, ${CITY}. For anything about personal data: ${EMAIL}.`,
          ],
        },
        {
          heading: 'What we process',
          paragraphs: ['Only what running the service requires:'],
          bullets: [
            'Account data: name, email address and an encrypted password.',
            'The documents you upload: receipts and invoices, and the data they contain (supplier, amounts, VAT, IBAN and payment reference where printed).',
            'Technical logs needed to operate and protect the service.',
          ],
        },
        {
          heading: 'Why',
          paragraphs: [
            'To extract the data from your documents, show it to you, let you review and export it, and to decide and prepare payment files when you use that feature. The legal basis is performance of the contract you enter when you create an account.',
            'We do not sell your data, do not share it for advertising and do not use it to train AI models.',
          ],
        },
        {
          heading: 'Who else is involved',
          paragraphs: ['Three providers, all acting as processors:'],
          bullets: [
            'Anthropic (Claude Vision): receives the uploaded document to extract its data.',
            'Supabase: database and file storage, region eu-central-2 (Zurich, Switzerland).',
            'Vercel: hosting and rendering, region fra1 (Frankfurt, Germany).',
          ],
        },
        {
          heading: 'Where it lives',
          paragraphs: [
            'Documents and extracted data are stored in Switzerland (Supabase, eu-central-2). The application runs in Germany (Vercel, fra1). Extraction through Claude Vision may involve a transfer to the United States under the provider’s standard contractual clauses.',
          ],
        },
        {
          heading: 'For how long',
          paragraphs: [
            'While your account is active. You can delete individual documents at any time and request full account deletion by email. The payment audit log is immutable by design: it is never edited or deleted, because its value depends on that.',
          ],
        },
        {
          heading: 'Your rights',
          paragraphs: [
            'Access, rectification, erasure, restriction, portability and objection — by email to the contact address. You may complain to your data protection authority in the EU, or to the FDPIC in Switzerland.',
          ],
        },
        {
          heading: 'Cookies',
          paragraphs: [
            'Only technical cookies: one to remember your language, and those needed to keep you signed in. No advertising or third-party tracking cookies. Our usage analytics are aggregated and cookie-free.',
          ],
        },
      ],
    },
    terms: {
      title: 'Terms of service',
      updated: UPDATED,
      intro: 'The rules for using Invoice Auto. Short version: use it sensibly and check what the AI extracted.',
      sections: [
        {
          heading: 'The service',
          paragraphs: [
            'Invoice Auto digitises receipts and invoices with AI, computes VAT in the jurisdictions it supports, and prepares SEPA and ISO 20022 pain.001 payment files.',
          ],
        },
        {
          heading: 'Beta',
          paragraphs: [
            'The service is in beta and free of charge. There is no service level agreement: it may be interrupted and features may change. We will give reasonable notice before introducing a price.',
          ],
        },
        {
          heading: 'Your responsibility',
          paragraphs: [
            'Automatic extraction can be wrong. Review the data before using it for tax filings or payment instructions. Invoice Auto is a tool, not a tax or accounting adviser, and does not replace professional review.',
            'You are responsible for having the right to upload the documents you upload.',
          ],
        },
        {
          heading: 'Payments',
          paragraphs: [
            'The payments feature produces files that you submit to your own bank. Invoice Auto does not move money, does not access your bank accounts and does not execute transfers.',
          ],
        },
        {
          heading: 'Liability',
          paragraphs: [
            'To the extent the applicable law allows, liability is limited to intent and gross negligence. No liability for tax penalties, wrong payments or losses arising from data you approved without reviewing.',
          ],
        },
        {
          heading: 'Governing law',
          paragraphs: [
            'Swiss law applies, with jurisdiction in Basel, without prejudice to mandatory consumer rights in your country of residence.',
          ],
        },
      ],
    },
    imprint: {
      title: 'Legal notice',
      updated: UPDATED,
      intro: 'Who runs this site.',
      sections: [
        { heading: 'Operator', paragraphs: [`${OPERATOR}`, `${CITY}`, `Email: ${EMAIL}`] },
        {
          heading: 'Purpose',
          paragraphs: [
            'Invoice Auto is an AI-assisted receipt and invoice capture service for freelancers and small businesses.',
          ],
        },
        {
          heading: 'Intellectual property',
          paragraphs: [
            'The content and code of this site belong to its owner. Third-party trademarks belong to their respective owners.',
          ],
        },
      ],
    },
  },
} satisfies Record<string, LegalContent>

export function getLegal(locale: string): LegalContent {
  return LEGAL[locale as keyof typeof LEGAL] ?? LEGAL.es
}
