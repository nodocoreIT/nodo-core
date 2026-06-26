/**
 * ContractLocacionDocument — React-PDF component for the Argentine "Contrato de Locación" (16 clauses).
 *
 * IMPORTANT: This module imports @react-pdf/renderer at the top level.
 * It MUST only be loaded via dynamic import() — never statically imported
 * from any file on the admin bundle critical path. (HEADLINE-2 / ADR-5)
 *
 * The component is pure / presentational: it reads ContractDocumentData verbatim
 * and never re-computes amounts or queries the DB. (HEADLINE-1)
 *
 * Disclaimer is mandatory and non-removable per HEADLINE-3.
 */

import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";
import type { ContractDocumentData } from "@/features/contracts/lib/contract-locacion-data";

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 9,
    padding: 35,
    paddingBottom: 50,
    color: "#000000",
    backgroundColor: "#ffffff",
  },
  // Header band
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    borderBottomStyle: "solid",
  },
  headerLeft: {
    flexDirection: "column",
    flex: 1,
  },
  logo: {
    width: 60,
    height: 30,
    objectFit: "contain",
  },
  agencyName: {
    fontSize: 11,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    marginBottom: 2,
  },
  agencyDetail: {
    fontSize: 8,
    color: "#64748b",
    marginTop: 1,
  },
  // Disclaimer band
  disclaimer: {
    backgroundColor: "#fff7ed",
    borderWidth: 1,
    borderColor: "#fed7aa",
    borderStyle: "solid",
    padding: 6,
    marginBottom: 12,
  },
  disclaimerText: {
    fontSize: 7,
    color: "#9a3412",
    lineHeight: 1.3,
  },
  // Title
  titleSection: {
    marginBottom: 12,
  },
  title: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    textAlign: "center",
    marginBottom: 3,
  },
  // Intro paragraph
  introParagraph: {
    fontSize: 9,
    color: "#334155",
    lineHeight: 1.6,
    marginBottom: 12,
    textAlign: "justify",
  },
  // Clause
  clauseSection: {
    marginBottom: 10,
  },
  clauseTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    color: "#000000",
    marginBottom: 3,
  },
  clauseText: {
    fontSize: 9,
    color: "#334155",
    lineHeight: 1.5,
    textAlign: "justify",
  },
  clauseDetail: {
    fontSize: 9,
    color: "#475569",
    marginTop: 2,
    lineHeight: 1.5,
    marginLeft: 12,
  },
  // Signature block
  signatureBlock: {
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopStyle: "solid",
  },
  signatureIntro: {
    fontSize: 9,
    color: "#334155",
    marginBottom: 14,
  },
  signatureRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 12,
  },
  signatureLine: {
    flexDirection: "column",
    alignItems: "center",
    width: "25%",
  },
  signatureBar: {
    borderTopWidth: 1,
    borderTopColor: "#1a1a2e",
    borderTopStyle: "solid",
    width: "100%",
    marginBottom: 3,
  },
  signatureLabel: {
    fontSize: 8,
    color: "#475569",
    textAlign: "center",
  },
  signatureAclaracion: {
    fontSize: 8,
    color: "#475569",
    textAlign: "center",
    marginTop: 2,
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 20,
    left: 35,
    right: 35,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    borderTopStyle: "solid",
    paddingTop: 4,
  },
  footerText: {
    fontSize: 7,
    color: "#94a3b8",
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function blank(val: string | undefined | null): string {
  return val && val.trim() ? val : "____";
}

function dash(val: string | undefined | null): string {
  return val && val.trim() ? val : "—";
}

// Extract day/month/year from dd/mm/yyyy format
function parseDateParts(dateStr: string): { day: string; month: string; year: string } {
  if (!dateStr || !dateStr.includes("/")) {
    return { day: "____", month: "____", year: "____" };
  }
  const [day, month, year] = dateStr.split("/");
  return { day: day || "____", month: month || "____", year: year || "____" };
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ContractLocacionDocument(props: ContractDocumentData) {
  const {
    agencyName,
    agencyAddress,
    cuit,
    logoUrl,
    locador,
    locatario,
    garantes,
    propertyAddress,
    rooms,
    sqm,
    inventoryDescription,
    petsAllowed,
    startDate,
    endDate,
    durationMonths,
    rentAmount,
    adjustmentIndexLabel,
    adjustmentPeriodMonths,
    depositAmount,
    signingCity,
    signingDate,
    paymentDueDay,
    dailyInterestRate,
    agencyName: agName,
  } = props;

  const generatedAt = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const startDateParts = parseDateParts(startDate);
  const endDateParts = parseDateParts(endDate);
  const signingDateParts = parseDateParts(signingDate);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            {agencyName ? <Text style={styles.agencyName}>{agencyName}</Text> : null}
            {agencyAddress ? <Text style={styles.agencyDetail}>{agencyAddress}</Text> : null}
            {cuit ? <Text style={styles.agencyDetail}>CUIT: {cuit}</Text> : null}
          </View>
          {logoUrl ? <Image src={logoUrl} style={styles.logo} /> : null}
        </View>

        {/* ── Disclaimer ────────────────────────────────────────────────── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            Este documento es un modelo orientativo generado automáticamente. Se recomienda su revisión
            por un profesional del derecho antes de la firma. La inmobiliaria no asume responsabilidad
            por el contenido legal del presente modelo.
          </Text>
        </View>

        {/* ── Title ─────────────────────────────────────────────────────── */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>CONTRATO DE LOCACIÓN</Text>
        </View>

        {/* ── Intro paragraph ───────────────────────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.introParagraph}>
            En la ciudad de {blank(signingCity)}, Provincia de {blank("Buenos Aires")}, a los{" "}
            {blank(signingDateParts.day)} días del mes de {blank(signingDateParts.month)} de{" "}
            {blank(signingDateParts.year)}, entre {dash(locador.name)}, DNI Nº{" "}
            {blank(locador.dni)}, con domicilio en {blank(locador.address)}, en adelante denominado
            EL LOCADOR, por una parte; y por la otra {dash(locatario.name)}, DNI Nº{" "}
            {blank(locatario.dni)}, con domicilio en el inmueble objeto de la presente locación, en
            adelante denominado EL LOCATARIO, manifiestan ser personas plenamente capaces para
            contratar y convienen celebrar el presente Contrato de Locación, sujeto a las siguientes
            cláusulas:
          </Text>
        </View>

        {/* ── PRIMERA: OBJETO ───────────────────────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>PRIMERA: OBJETO</Text>
          <Text style={styles.clauseText}>
            EL LOCADOR da en locación a EL LOCATARIO, quien acepta, el inmueble destinado a vivienda
            ubicado en {dash(propertyAddress)}
            {rooms ? `, ${rooms} ambiente${Number(rooms) !== 1 ? "s" : ""}` : ""}
            {sqm ? `, ${sqm} m²` : ""}.
          </Text>
          {inventoryDescription && (
            <Text style={styles.clauseDetail}>Artefactos e instalaciones: {inventoryDescription}</Text>
          )}
          <Text style={styles.clauseDetail}>
            EL LOCATARIO declara conocer el estado de conservación del inmueble y recibirlo en
            condiciones, obligándose a restituirlo al finalizar la locación en el mismo estado en que lo
            recibe, salvo el desgaste normal producido por el uso adecuado y el transcurso del tiempo.
          </Text>
        </View>

        {/* ── SEGUNDA: DESTINO ──────────────────────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>SEGUNDA: DESTINO</Text>
          <Text style={styles.clauseText}>
            El inmueble será destinado exclusivamente a vivienda familiar, quedando prohibido darle
            cualquier otro destino, subarrendarlo, cederlo o permitir su ocupación por terceros sin
            autorización escrita del LOCADOR. EL LOCATARIO se compromete a respetar las normas de
            convivencia y evitar ruidos molestos.
          </Text>
          <Text style={styles.clauseDetail}>
            {petsAllowed
              ? "( ✓ ) Se permiten mascotas."
              : "( ) No se permiten mascotas. El incumplimiento de esta condición podrá constituir causal de resolución del contrato."}
          </Text>
        </View>

        {/* ── TERCERA: PLAZO ────────────────────────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>TERCERA: PLAZO</Text>
          <Text style={styles.clauseText}>
            La duración de la presente locación será de {durationMonths} ({blank(String(durationMonths))})
            meses, comenzando el día {startDateParts.day} de {blank(startDateParts.month)} de{" "}
            {startDateParts.year} y finalizando el día {endDateParts.day} de {blank(endDateParts.month)}{" "}
            de {endDateParts.year}.
          </Text>
        </View>

        {/* ── CUARTA: PRECIO Y ACTUALIZACIÓN ──────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>CUARTA: PRECIO Y ACTUALIZACIÓN</Text>
          <Text style={styles.clauseText}>
            El canon locativo se fija en la suma mensual de {rentAmount}. Las partes acuerdan que el
            alquiler se actualizará cada {adjustmentPeriodMonths} meses, conforme al índice{" "}
            {adjustmentIndexLabel}, aplicándose sobre el valor vigente al momento de cada
            actualización.
          </Text>
        </View>

        {/* ── QUINTA: FORMA DE PAGO Y MORA ──────────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>QUINTA: FORMA DE PAGO - MORA</Text>
          <Text style={styles.clauseText}>
            El alquiler deberá abonarse por mes adelantado hasta el día {paymentDueDay} de cada mes.
            La falta de pago producirá la mora automática sin necesidad de interpelación. Las partes
            acuerdan un interés moratorio del {dailyInterestRate}% por día sobre las sumas adeudadas
            hasta el efectivo pago.
          </Text>
        </View>

        {/* ── SEXTA: INTRANSFERIBILIDAD ─────────────────────────────────– */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>SEXTA: INTRANSFERIBILIDAD</Text>
          <Text style={styles.clauseText}>
            Queda prohibido ceder, transferir, prestar o subarrendar el inmueble, total o parcialmente.
          </Text>
        </View>

        {/* ── SÉPTIMA: INCUMPLIMIENTO ───────────────────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>SÉPTIMA: INCUMPLIMIENTO</Text>
          <Text style={styles.clauseText}>
            El incumplimiento de cualquiera de las obligaciones asumidas facultará al LOCADOR a exigir
            el cumplimiento del contrato o su resolución, con más los daños y perjuicios que
            correspondan.
          </Text>
        </View>

        {/* ── OCTAVA: IMPUESTOS, TASAS Y SERVICIOS ────────────────────── */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>OCTAVA: IMPUESTOS, TASAS Y SERVICIOS</Text>
          <Text style={styles.clauseText}>
            Serán a cargo del LOCATARIO: Energía eléctrica, Gas, Agua, Internet, Cable, Telefonía,
            Tasas y servicios municipales que correspondan al uso del inmueble, Expensas ordinarias
            (si las hubiere).
          </Text>
          <Text style={styles.clauseDetail}>
            Serán a cargo del LOCADOR los impuestos y obligaciones que legalmente le correspondan como
            propietario.
          </Text>
        </View>

        {/* ── NOVENA: RESPONSABILIDAD ───────────────────────────────────– */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>NOVENA: RESPONSABILIDAD</Text>
          <Text style={styles.clauseText}>
            EL LOCADOR no responderá por daños ocasionados por caso fortuito, fuerza mayor, hechos de
            terceros o desperfectos ajenos a su responsabilidad. EL LOCATARIO responderá por los daños
            ocasionados por su culpa, negligencia o por las personas por quienes deba responder.
          </Text>
        </View>

        {/* ── DÉCIMA: MODIFICACIONES ────────────────────────────────────– */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>DÉCIMA: MODIFICACIONES</Text>
          <Text style={styles.clauseText}>
            EL LOCATARIO no podrá efectuar modificaciones, mejoras o reformas sin autorización escrita
            del LOCADOR. Toda mejora incorporada quedará en beneficio del inmueble sin derecho a
            compensación, salvo pacto expreso en contrario.
          </Text>
        </View>

        {/* ── DÉCIMO PRIMERA: GARANTÍA ──────────────────────────────────– */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>DÉCIMO PRIMERA: GARANTÍA</Text>
          <Text style={styles.clauseText}>Actúa como fiador solidario y principal pagador:</Text>
          {garantes.length > 0 ? (
            garantes.map((g, i) => (
              <View key={i}>
                <Text style={styles.clauseDetail}>
                  {garantes.length > 1 ? `Garante ${i + 1}:` : ""}
                </Text>
                <Text style={styles.clauseDetail}>Nombre: {dash(g.name)}</Text>
                <Text style={styles.clauseDetail}>DNI: {blank(g.dni)}</Text>
                <Text style={styles.clauseDetail}>Domicilio: {blank(g.address)}</Text>
                <Text style={styles.clauseDetail}>
                  Teléfono: {blank(g.phone)}
                </Text>
                <Text style={styles.clauseDetail}>
                  El garante renuncia expresamente a los beneficios de división y excusión y responderá
                  por todas las obligaciones emergentes del presente contrato.
                </Text>
              </View>
            ))
          ) : (
            <Text style={styles.clauseDetail}>
              Nombre: ______________________
              {"\n"}DNI: ______________________
              {"\n"}Domicilio: ______________________________________________________
              {"\n"}Teléfono: ______________________
            </Text>
          )}
        </View>

        {/* ── DÉCIMO SEGUNDA: REPARACIONES ──────────────────────────────– */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>DÉCIMO SEGUNDA: REPARACIONES</Text>
          <Text style={styles.clauseText}>
            EL LOCATARIO deberá comunicar inmediatamente cualquier desperfecto. Las reparaciones
            originadas por los defectos propios del inmueble serán a cargo del LOCADOR. Las reparaciones
            ocasionadas por culpa o negligencia del LOCATARIO serán exclusivamente a su cargo.
          </Text>
        </View>

        {/* ── DÉCIMO TERCERA: RESOLUCIÓN ANTICIPADA ─────────────────────– */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>DÉCIMO TERCERA: RESOLUCIÓN ANTICIPADA</Text>
          <Text style={styles.clauseText}>
            EL LOCATARIO podrá rescindir anticipadamente el contrato conforme la legislación vigente,
            notificando fehacientemente al LOCADOR con la anticipación legal correspondiente y abonando,
            en su caso, la indemnización prevista por la normativa aplicable.
          </Text>
        </View>

        {/* ── DÉCIMO CUARTA: PAGARÉ EN GARANTÍA ─────────────────────────– */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>DÉCIMO CUARTA: PAGARÉ EN GARANTÍA</Text>
          <Text style={styles.clauseText}>
            EL LOCATARIO entrega en este acto un pagaré por la suma de {depositAmount}, con cláusula
            "sin protesto", en garantía del cumplimiento de todas las obligaciones emergentes del
            presente contrato. El pagaré sólo podrá ejecutarse en caso de incumplimiento contractual.
          </Text>
        </View>

        {/* ── DÉCIMO QUINTA: JURISDICCIÓN ───────────────────────────────– */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>DÉCIMO QUINTA: JURISDICCIÓN</Text>
          <Text style={styles.clauseText}>
            Para todos los efectos legales derivados del presente contrato, las partes constituyen los
            domicilios indicados precedentemente y se someten a la competencia de los Tribunales
            Ordinarios de la ciudad de {blank(signingCity)}, con renuncia a cualquier otro fuero o
            jurisdicción.
          </Text>
        </View>

        {/* ── DÉCIMO SEXTA: CONFORMIDAD ─────────────────────────────────– */}
        <View style={styles.clauseSection}>
          <Text style={styles.clauseTitle}>DÉCIMO SEXTA: CONFORMIDAD</Text>
          <Text style={styles.clauseText}>
            Leído el presente contrato, las partes manifiestan su conformidad y firman dos ejemplares
            de un mismo tenor y a un solo efecto, en el lugar y fecha indicados al comienzo.
          </Text>
        </View>

        {/* ── Signature block ───────────────────────────────────────────– */}
        <View style={styles.signatureBlock} wrap={false}>
          <View style={styles.signatureRow}>
            <View style={styles.signatureLine}>
              <View style={styles.signatureBar} />
              <Text style={styles.signatureLabel}>EL LOCADOR</Text>
              <Text style={styles.signatureAclaracion}>Firma: ________</Text>
              <Text style={styles.signatureAclaracion}>Aclaración: ________</Text>
              <Text style={styles.signatureAclaracion}>DNI: ________</Text>
            </View>
            <View style={styles.signatureLine}>
              <View style={styles.signatureBar} />
              <Text style={styles.signatureLabel}>EL LOCATARIO</Text>
              <Text style={styles.signatureAclaracion}>Firma: ________</Text>
              <Text style={styles.signatureAclaracion}>Aclaración: ________</Text>
              <Text style={styles.signatureAclaracion}>DNI: ________</Text>
            </View>
            <View style={styles.signatureLine}>
              <View style={styles.signatureBar} />
              <Text style={styles.signatureLabel}>FIADOR</Text>
              <Text style={styles.signatureAclaracion}>Firma: ________</Text>
              <Text style={styles.signatureAclaracion}>Aclaración: ________</Text>
              <Text style={styles.signatureAclaracion}>DNI: ________</Text>
            </View>
          </View>
        </View>

        {/* ── Footer ────────────────────────────────────────────────────– */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Generado por {agName || "—"} — {generatedAt}
          </Text>
        </View>
      </Page>
    </Document>
  );
}
