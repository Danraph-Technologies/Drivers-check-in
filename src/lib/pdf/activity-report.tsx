import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
} from '@react-pdf/renderer';

/**
 * The printable Drivers Activity Report. Rendered server side with
 * @react-pdf/renderer (no Chromium, works on Vercel serverless).
 * Money is printed as plain numbers; the columns carry the (NGN) label
 * because the built-in PDF fonts have no Naira glyph.
 */

const BRAND = '#044dae';
const BRAND_DARK = '#073774';
const INK = '#171d29';
const INK_MUTED = '#677182';
const LINE = '#d7dbe2';
const SOFT = '#f3f5f8';

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: INK,
    paddingTop: 28,
    paddingBottom: 40,
    paddingHorizontal: 36,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: { width: 76, height: 20.2 },
  company: { fontFamily: 'Helvetica-Bold', fontSize: 13, color: INK },
  subtitle: { fontSize: 8, color: INK_MUTED, marginTop: 1 },
  period: {
    marginTop: 10,
    fontFamily: 'Helvetica-Bold',
    fontSize: 10.5,
    color: BRAND_DARK,
  },
  metaLine: { marginTop: 2, fontSize: 7.5, color: INK_MUTED },
  sectionTitle: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 9.5,
    color: INK,
    marginTop: 14,
    marginBottom: 6,
  },
  statRow: { flexDirection: 'row', gap: 6 },
  statBox: {
    flex: 1,
    borderWidth: 0.75,
    borderColor: LINE,
    borderRadius: 4,
    padding: 7,
  },
  statLabel: {
    fontSize: 6,
    color: INK_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    fontFamily: 'Helvetica-Bold',
  },
  statValue: { fontFamily: 'Helvetica-Bold', fontSize: 10, marginTop: 3 },
  netBox: {
    marginTop: 8,
    backgroundColor: BRAND,
    borderRadius: 5,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  netLabel: { color: '#ffffff', fontSize: 9, fontFamily: 'Helvetica-Bold' },
  netSub: { color: '#d9e8fa', fontSize: 7, marginTop: 2 },
  netValue: {
    color: '#ffffff',
    fontSize: 15,
    fontFamily: 'Helvetica-Bold',
    marginLeft: 'auto',
  },
  table: { borderWidth: 0.75, borderColor: LINE, borderRadius: 4 },
  tr: { flexDirection: 'row', minHeight: 15, alignItems: 'center' },
  trAlt: { backgroundColor: SOFT },
  th: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 6.4,
    color: INK_MUTED,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    padding: 4,
  },
  td: { fontSize: 7.6, padding: 4 },
  tdBold: { fontFamily: 'Helvetica-Bold', fontSize: 7.6 },
  tdNum: { fontSize: 7.6, textAlign: 'right', padding: 4 },
  tdNumBold: { fontFamily: 'Helvetica-Bold', fontSize: 7.6, textAlign: 'right', padding: 4 },
  trTotals: { backgroundColor: '#eef5fd', borderTopWidth: 0.75, borderColor: LINE },
  voided: { color: '#9aa2b1' },
  footnote: { fontSize: 7, color: INK_MUTED, marginTop: 4 },
  footer: {
    position: 'absolute',
    bottom: 22,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: INK_MUTED,
    borderTopWidth: 0.75,
    borderColor: LINE,
    paddingTop: 6,
  },
});

export type PdfTripRow = {
  tripDate: string;
  driverName: string;
  busLabel: string | null;
  from: string;
  to: string;
  seats: number;
  perSeat: number;
  seatsTotal: number;
  cargo: number;
  fuel: number;
  feeding: number;
  net: number;
  arrival: string;
  isVoided: boolean;
};

export type PdfDriverRow = {
  driverName: string;
  busLabel: string | null;
  trips: number;
  seats: number;
  trip: number;
  cargo: number;
  fuel: number;
  feeding: number;
  net: number;
};

export type PdfDayRow = { day: string; revenue: number };

export type ActivityReportProps = {
  logoDataUri: string;
  periodLabel: string;
  generatedLabel: string;
  totals: {
    trips: number;
    seats: number;
    tripEarnings: number;
    cargoEarnings: number;
    fuel: number;
    feeding: number;
    net: number;
  };
  drivers: PdfDriverRow[];
  days: PdfDayRow[];
  trips: PdfTripRow[];
  voidedCount: number;
};

const ng = (n: number) => n.toLocaleString('en-NG');

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function DailyBars({ days }: { days: PdfDayRow[] }) {
  const max = Math.max(1, ...days.map((d) => d.revenue));
  return (
    <View>
      {days.map((d) => (
        <View key={d.day} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 3 }}>
          <Text style={{ width: 78, fontSize: 7, color: INK_MUTED }}>{d.day}</Text>
          <View
            style={{
              width: 210 * (d.revenue / max),
              height: 9,
              backgroundColor: BRAND,
              borderRadius: 2,
            }}
          />
          <Text style={{ marginLeft: 6, fontSize: 7.5, fontFamily: 'Helvetica-Bold' }}>
            {ng(d.revenue)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function DriverTable({
  drivers,
  totals,
}: Pick<ActivityReportProps, 'drivers'> & { totals: ActivityReportProps['totals'] }) {
  const widths = [104, 52, 30, 32, 62, 58, 44, 46, 60];
  const headers = [
    'Driver',
    'Bus',
    'Trips',
    'Seats',
    'Trip (NGN)',
    'Cargo (NGN)',
    'Fuel (NGN)',
    'Feeding (NGN)',
    'Net (NGN)',
  ];
  return (
    <View style={styles.table}>
      <View style={[styles.tr, { backgroundColor: SOFT }]}>
        {headers.map((h, i) => (
          <Text
            key={h}
            style={[styles.th, { width: widths[i] }, ...(i >= 2 ? [{ textAlign: 'right' as const }] : [])]}
          >
            {h}
          </Text>
        ))}
      </View>
      {drivers.map((d, i) => (
        <View
          key={`${d.driverName}-${i}`}
          style={[styles.tr, ...(i % 2 === 1 ? [styles.trAlt] : [])]}
          wrap={false}
        >
          <Text style={[styles.tdBold, { width: widths[0] }]}>{d.driverName}</Text>
          <Text style={[styles.td, { width: widths[1] }]}>{d.busLabel ?? '-'}</Text>
          <Text style={[styles.tdNum, { width: widths[2] }]}>{d.trips}</Text>
          <Text style={[styles.tdNum, { width: widths[3] }]}>{d.seats}</Text>
          <Text style={[styles.tdNum, { width: widths[4] }]}>{ng(d.trip)}</Text>
          <Text style={[styles.tdNum, { width: widths[5] }]}>{ng(d.cargo)}</Text>
          <Text style={[styles.tdNum, { width: widths[6] }]}>{ng(d.fuel)}</Text>
          <Text style={[styles.tdNum, { width: widths[7] }]}>{ng(d.feeding)}</Text>
          <Text style={[styles.tdNumBold, { width: widths[8] }]}>{ng(d.net)}</Text>
        </View>
      ))}
      <View style={[styles.tr, styles.trTotals]} wrap={false}>
        <Text style={[styles.tdBold, { width: widths[0] + widths[1] }]}>Total</Text>
        <Text style={[styles.tdNumBold, { width: widths[2] }]}>{totals.trips}</Text>
        <Text style={[styles.tdNumBold, { width: widths[3] }]}>{totals.seats}</Text>
        <Text style={[styles.tdNumBold, { width: widths[4] }]}>{ng(totals.tripEarnings)}</Text>
        <Text style={[styles.tdNumBold, { width: widths[5] }]}>{ng(totals.cargoEarnings)}</Text>
        <Text style={[styles.tdNumBold, { width: widths[6] }]}>{ng(totals.fuel)}</Text>
        <Text style={[styles.tdNumBold, { width: widths[7] }]}>{ng(totals.feeding)}</Text>
        <Text style={[styles.tdNumBold, { width: widths[8] }]}>{ng(totals.net)}</Text>
      </View>
    </View>
  );
}

function TripTable({ trips }: { trips: PdfTripRow[] }) {
  const widths = [44, 72, 80, 26, 44, 52, 46, 36, 36, 50, 35];
  const headers = [
    'Date',
    'Driver',
    'Route',
    'Seats',
    'Per seat (NGN)',
    'Trip (NGN)',
    'Cargo (NGN)',
    'Fuel (NGN)',
    'Feed (NGN)',
    'Net (NGN)',
    'Arrival',
  ];
  return (
    <View style={styles.table}>
      <View style={[styles.tr, { backgroundColor: SOFT }]}>
        {headers.map((h, i) => (
          <Text
            key={h}
            style={[styles.th, { width: widths[i] }, ...(i >= 3 ? [{ textAlign: 'right' as const }] : [])]}
          >
            {h}
          </Text>
        ))}
      </View>
      {trips.map((t, i) => (
        <View
          key={`${t.tripDate}-${i}`}
          style={[styles.tr, ...(i % 2 === 1 ? [styles.trAlt] : [])]}
          wrap={false}
        >
          <Text style={[styles.td, { width: widths[0] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {t.tripDate.slice(5)}
          </Text>
          <Text style={[styles.td, { width: widths[1] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {t.driverName}
          </Text>
          <Text style={[styles.td, { width: widths[2] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {t.from} - {t.to}
            {t.isVoided ? ' (VOIDED)' : ''}
          </Text>
          <Text style={[styles.tdNum, { width: widths[3] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {t.seats}
          </Text>
          <Text style={[styles.tdNum, { width: widths[4] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {ng(t.perSeat)}
          </Text>
          <Text style={[styles.tdNum, { width: widths[5] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {ng(t.seatsTotal)}
          </Text>
          <Text style={[styles.tdNum, { width: widths[6] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {ng(t.cargo)}
          </Text>
          <Text style={[styles.tdNum, { width: widths[7] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {ng(t.fuel)}
          </Text>
          <Text style={[styles.tdNum, { width: widths[8] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {ng(t.feeding)}
          </Text>
          <Text style={[styles.tdNumBold, { width: widths[9] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {ng(t.net)}
          </Text>
          <Text style={[styles.tdNum, { width: widths[10] }, ...(t.isVoided ? [styles.voided] : [])]}>
            {t.arrival}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ActivityReportDocument(props: ActivityReportProps) {
  const { totals } = props;
  return (
    <Document
      title={`DanRaph Drivers Activity Report ${props.periodLabel}`}
      author="DanRaph Integrated Services"
    >
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <Image src={props.logoDataUri} style={styles.logo} />
          <View>
            <Text style={styles.company}>DanRaph Integrated Services</Text>
            <Text style={styles.subtitle}>Drivers Activity Report</Text>
          </View>
        </View>
        <Text style={styles.period}>{props.periodLabel}</Text>
        <Text style={styles.metaLine}>Generated {props.generatedLabel}</Text>

        <Text style={styles.sectionTitle}>Summary</Text>
        <View style={styles.statRow}>
          <StatBox label="Trips" value={String(totals.trips)} />
          <StatBox label="Seats" value={String(totals.seats)} />
          <StatBox label="Trip earnings" value={ng(totals.tripEarnings)} />
          <StatBox label="Cargo earnings" value={ng(totals.cargoEarnings)} />
          <StatBox label="Fuel" value={ng(totals.fuel)} />
          <StatBox label="Feeding" value={ng(totals.feeding)} />
        </View>
        <View style={styles.netBox}>
          <View>
            <Text style={styles.netLabel}>Net profit</Text>
            <Text style={styles.netSub}>Trip earnings minus fuel and feeding; cargo goes to the driver</Text>
          </View>
          <Text style={styles.netValue}>NGN {ng(totals.net)}</Text>
        </View>

        <Text style={styles.sectionTitle}>Per driver</Text>
        <DriverTable drivers={props.drivers} totals={totals} />

        {props.days.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Daily earnings</Text>
            <DailyBars days={props.days} />
          </>
        ) : null}

        <Text style={styles.sectionTitle}>Trip details</Text>
        <TripTable trips={props.trips} />
        {props.voidedCount > 0 ? (
          <Text style={styles.footnote}>
            {props.voidedCount} voided report{props.voidedCount === 1 ? '' : 's'} shown in grey and
            excluded from all totals.
          </Text>
        ) : null}
        <Text style={styles.footnote}>
          Cargo is paid to the driver, so net profit is trip earnings minus fuel and feeding only.
        </Text>

        <View style={styles.footer} fixed>
          <Text>DanRaph Integrated Services - Drivers Activity Report</Text>
          <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
