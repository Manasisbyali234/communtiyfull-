import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';
import {
  Animated,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

// ── Data ─────────────────────────────────────────────────────────────────────

const SERVICES = [
  { id: 'tractor',    icon: 'construct-outline',     label: 'Traction',                   color: '#F57F17' },
  { id: 'pesticide',  icon: 'flask-outline',         label: 'Pesticide Calc',             color: '#00695C' },
  { id: 'price',      icon: 'calculator-outline',    label: 'Price Calculator',           color: '#6A1B9A' },
  { id: 'market',     icon: 'trending-up-outline',   label: 'Market Rates',               color: '#C62828' },
];

const SCHEMES = [
  { id: 'pmkisan',  icon: 'cash-outline',             label: 'PM-Kisan',                  color: '#2E7D32', bg: '#EAF7EC' },
  { id: 'shc',      icon: 'layers-outline',           label: 'Soil Health Card',           color: '#6D4C41', bg: '#F4EEEB' },
  { id: 'pmfby',    icon: 'shield-checkmark-outline', label: 'PMFBY (Crop Insurance)',     color: '#1565C0', bg: '#EAF4FF' },
  { id: 'kcc',      icon: 'card-outline',             label: 'Kisan Credit Card',          color: '#6A1B9A', bg: '#EFE9FF' },
];



// ── Component ─────────────────────────────────────────────────────────────────

export default function KrushiMitraScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const [search, setSearch] = useState('');
  const scrollY = useRef(new Animated.Value(0)).current;
  const [showTraction, setShowTraction] = useState(false);
  const [tractorType, setTractorType] = useState<'Mini' | '2WD' | '4WD'>('2WD');
  const [tractorArea, setTractorArea] = useState('');
  const [tractorDate, setTractorDate] = useState('');
  const [tractorNotes, setTractorNotes] = useState('');
  const [tractionBooked, setTractionBooked] = useState(false);
  const resetTraction = () => { setTractorArea(''); setTractorDate(''); setTractorNotes(''); setTractionBooked(false); };
  const bookTraction = () => { if (tractorArea && tractorDate) setTractionBooked(true); };
  const [showCalc, setShowCalc] = useState(false);
  const [showPesticideCalc, setShowPesticideCalc] = useState(false);
  const [pesticideArea, setPesticideArea] = useState('');
  const [pesticideDose, setPesticideDose] = useState('');
  const [pesticideWater, setPesticideWater] = useState('');
  const [pesticideUnit, setPesticideUnit] = useState<'ml' | 'g'>('ml');
  const [pesticideResult, setPesticideResult] = useState<{ qty: string; water: string } | null>(null);
  const resetPesticide = () => { setPesticideArea(''); setPesticideDose(''); setPesticideWater(''); setPesticideResult(null); };
  const calcPesticide = () => {
    const area = parseFloat(pesticideArea) || 0;
    const dose = parseFloat(pesticideDose) || 0;
    const water = parseFloat(pesticideWater) || 0;
    if (area <= 0 || dose <= 0) return;
    setPesticideResult({
      qty: (area * dose).toFixed(2),
      water: water > 0 ? (area * water).toFixed(2) : '',
    });
  };
  const [quantity, setQuantity] = useState('');
  const [ratePerUnit, setRatePerUnit] = useState('');
  const [extraKg, setExtraKg] = useState('');
  const [extraKgRate, setExtraKgRate] = useState('');

  const qty = parseFloat(quantity) || 0;
  const rate = parseFloat(ratePerUnit) || 0;
  const extra = parseFloat(extraKg) || 0;
  const extraRate = parseFloat(extraKgRate) || 0;
  const baseAmount = qty * rate;
  const extraAmount = extra * extraRate;
  const totalAmount = baseAmount + extraAmount;
  const hasResult = qty > 0 && rate > 0;
  const resetCalc = () => { setQuantity(''); setRatePerUnit(''); setExtraKg(''); setExtraKgRate(''); };

  // ── Weather summary for Welcome card ────────────────────────────────────
  type WForecastDay = { day: string; icon: string; tempMax: number; tempMin: number; rain: number };
  const [welcomeWeather, setWelcomeWeather] = useState<{ temp: number; condition: string; icon: string } | null>(null);
  const [welcomeForecast, setWelcomeForecast] = useState<WForecastDay[]>([]);

  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  function codeToMeta(code: number) {
    if (code === 800) return { condition: 'Clear Sky', icon: 'sunny-outline' };
    if (code <= 802)  return { condition: 'Partly Cloudy', icon: 'partly-sunny-outline' };
    if (code >= 803)  return { condition: 'Overcast', icon: 'cloudy-outline' };
    if (code >= 500)  return { condition: 'Rain', icon: 'rainy-outline' };
    if (code >= 200)  return { condition: 'Thunderstorm', icon: 'thunderstorm-outline' };
    return { condition: 'Cloudy', icon: 'cloudy-outline' };
  }

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('no permission');
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const { latitude: lat, longitude: lon } = loc.coords;
        const API_KEY = 'YOUR_WEATHERBIT_API_KEY';

        const [curRes, fcRes] = await Promise.all([
          fetch(`https://api.weatherbit.io/v2.0/current?lat=${lat}&lon=${lon}&key=${API_KEY}&units=M`),
          fetch(`https://api.weatherbit.io/v2.0/forecast/daily?lat=${lat}&lon=${lon}&key=${API_KEY}&units=M&days=3`),
        ]);
        if (!curRes.ok || !fcRes.ok) throw new Error('api error');

        const curData = await curRes.json();
        const c = curData.data[0];
        const { condition, icon } = codeToMeta(c.weather.code);
        setWelcomeWeather({ temp: Math.round(c.temp), condition, icon });

        const fcData = await fcRes.json();
        setWelcomeForecast(
          fcData.data.map((d: any, i: number) => ({
            day: i === 0 ? 'Today' : DAY_NAMES[new Date(d.datetime).getDay()],
            icon: codeToMeta(d.weather.code).icon,
            tempMax: Math.round(d.max_temp),
            tempMin: Math.round(d.min_temp),
            rain: Math.round(d.pop ?? 0),
          }))
        );
      } catch {
        setWelcomeWeather({ temp: 28, condition: 'Partly Cloudy', icon: 'partly-sunny-outline' });
        setWelcomeForecast([
          { day: 'Today',    icon: 'partly-sunny-outline', tempMax: 31, tempMin: 22, rain: 20 },
          { day: 'Tomorrow', icon: 'rainy-outline',        tempMax: 27, tempMin: 20, rain: 65 },
          { day: 'Day 3',    icon: 'sunny-outline',        tempMax: 33, tempMin: 23, rain: 5  },
        ]);
      }
    })();
  }, []);

  const filteredServices = SERVICES.filter((s) =>
    s.label.toLowerCase().includes(search.toLowerCase())
  );

  // ── Sub-renders ────────────────────────────────────────────────────────────

  const WelcomeCard = (
    <LinearGradient
      colors={['#1B5E20', '#2D6A2D', '#43A047']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.welcomeCard}
    >
      <View style={styles.wCircle1} />
      <View style={styles.wCircle2} />

      {/* Top row: text left, current weather right */}
      <View style={styles.welcomeTopRow}>
        <View style={styles.welcomeLeft}>
          <Text style={styles.welcomeTitle}>Welcome to{'\n'}Krushi Mitra</Text>
          <Text style={styles.welcomeSub}>Your Digital Farming Assistant</Text>
          <View style={styles.welcomeBadge}>
            <Ionicons name="shield-checkmark" size={12} color="#FFF" />
            <Text style={styles.welcomeBadgeText}>Govt. Verified</Text>
          </View>
        </View>

        <View style={styles.welcomeRight}>
          {welcomeWeather ? (
            <View style={styles.weatherBubble}>
              <Ionicons name={welcomeWeather.icon as any} size={32} color="#FFD54F" />
              <Text style={styles.weatherTemp}>{welcomeWeather.temp}°C</Text>
              <Text style={styles.weatherCond}>{welcomeWeather.condition}</Text>
            </View>
          ) : (
            <View style={styles.farmIllustration}>
              <Ionicons name="leaf" size={44} color="rgba(255,255,255,0.9)" />
              <View style={styles.farmIconRow}>
                <Ionicons name="sunny" size={20} color="#FFD54F" />
                <Ionicons name="water" size={20} color="#81D4FA" style={{ marginLeft: 6 }} />
              </View>
            </View>
          )}
        </View>
      </View>

      {/* Forecast strip */}
      {welcomeForecast.length > 0 && (
        <View style={styles.forecastStrip}>
          {welcomeForecast.map((d, i) => (
            <View key={i} style={[styles.forecastStripItem, i < welcomeForecast.length - 1 && styles.forecastStripBorder]}>
              <Text style={styles.forecastStripDay}>{d.day}</Text>
              <Ionicons name={d.icon as any} size={18} color="#FFD54F" style={{ marginVertical: 3 }} />
              <Text style={styles.forecastStripTemps}>{d.tempMax}° / {d.tempMin}°</Text>
              <View style={styles.forecastStripRain}>
                <Ionicons name="rainy-outline" size={10} color="rgba(255,255,255,0.75)" />
                <Text style={styles.forecastStripRainText}>{d.rain}%</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </LinearGradient>
  );

  const ServicesSection = (
    <View style={{ marginBottom: 20 }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Services</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesList}>
        {filteredServices.map((service) => (
          <TouchableOpacity
            key={service.id}
            activeOpacity={0.75}
            style={[styles.servicePill, { backgroundColor: colors.surface }]}
            onPress={() => {
              if (service.id === 'tractor') setShowTraction(true);
              else if (service.id === 'price') setShowCalc(true);
              else if (service.id === 'pesticide') setShowPesticideCalc(true);
              else if (service.id === 'market') router.push('/market-rates' as any);
            }}
          >
            <View style={[styles.servicePillIcon, { backgroundColor: service.color + '15' }]}>
              <Ionicons name={service.icon as any} size={22} color={service.color} />
            </View>
            <Text style={[styles.servicePillLabel, { color: colors.text }]}>{service.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  const SeasonalAdvisory = (
    <View style={[styles.seasonalCard, { backgroundColor: colors.primaryContainer, borderColor: colors.primary + '40' }]}>
      <View style={styles.seasonalHeader}>
        <View style={[styles.seasonalBadge, { backgroundColor: colors.primary }]}>
          <Ionicons name="sunny-outline" size={14} color="#FFF" />
          <Text style={styles.seasonalBadgeText}>Kharif Season</Text>
        </View>
      </View>
      <Text style={[styles.seasonalTitle, { color: colors.primaryDark }]}>Seasonal Advisory</Text>
      {['Prepare fields with deep ploughing', 'Buy quality certified seeds', 'Check weather before sowing'].map((tip, i) => (
        <View key={i} style={styles.tipRow}>
          <View style={[styles.tipDot, { backgroundColor: colors.primary }]} />
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>{tip}</Text>
        </View>
      ))}
      <TouchableOpacity style={[styles.learnMoreBtn, { backgroundColor: colors.primary }]} activeOpacity={0.8}>
        <Text style={styles.learnMoreText}>Learn More</Text>
        <Ionicons name="arrow-forward" size={14} color="#FFF" />
      </TouchableOpacity>
    </View>
  );

  const GovernmentSchemes = (
    <View style={{ marginBottom: 0 }}>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Government Schemes</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.schemesList}>
        {SCHEMES.map((item) => (
          <TouchableOpacity
            key={item.id}
            activeOpacity={0.8}
            style={[styles.schemePill, { backgroundColor: colors.surface }]}
            onPress={() => {
              if (item.id === 'pmkisan') Linking.openURL('https://pmkisan.gov.in/');
              else if (item.id === 'shc') Linking.openURL('https://soilhealth.dac.gov.in/home');
              else if (item.id === 'pmfby') Linking.openURL('https://pmfby.gov.in/');
              else if (item.id === 'kcc') Linking.openURL('https://www.myscheme.gov.in/schemes/kcc');
            }}
          >
            <View style={[styles.schemePillIcon, { backgroundColor: item.bg }]}>
              <Ionicons name={item.icon as any} size={22} color={item.color} />
            </View>
            <Text style={[styles.schemePillLabel, { color: colors.text }]}>{item.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );



  const PriceCalculatorModal = (
    <Modal visible={showCalc} transparent animationType="slide" onRequestClose={() => setShowCalc(false)}>
      <TouchableWithoutFeedback onPress={() => setShowCalc(false)}>
        <View style={styles.modalOverlay} />
      </TouchableWithoutFeedback>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalSheet}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
          <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
          <View style={styles.modalHeader}>
            <View style={[styles.modalIconWrap, { backgroundColor: '#6A1B9A18' }]}>
              <Ionicons name="calculator-outline" size={22} color="#6A1B9A" />
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Price Calculator</Text>
            <TouchableOpacity onPress={() => setShowCalc(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close" size={22} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View style={[styles.calcCard, { backgroundColor: colors.background, borderColor: colors.border }]}>
              {[
                { label: 'Quantity (bags / units)', placeholder: 'e.g. 10', value: quantity, setter: setQuantity, prefix: undefined, suffix: undefined },
                { label: 'Rate per unit (\u20b9 / 20 kg)', placeholder: 'e.g. 500', value: ratePerUnit, setter: setRatePerUnit, prefix: '\u20b9', suffix: '/ 20 kg' },
                { label: 'Extra kg', placeholder: 'e.g. 5', value: extraKg, setter: setExtraKg, prefix: undefined, suffix: undefined },
                { label: 'Extra kg rate (\u20b9 per kg)', placeholder: 'e.g. 25', value: extraKgRate, setter: setExtraKgRate, prefix: '\u20b9', suffix: '/ kg' },
              ].map((f, i) => (
                <View key={i} style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{f.label}</Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    {f.prefix && <Text style={[styles.affix, { color: colors.textMuted }]}>{f.prefix}</Text>}
                    <TextInput
                      style={[styles.calcInput, { color: colors.text }]}
                      placeholder={f.placeholder}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={f.value}
                      onChangeText={f.setter}
                    />
                    {f.suffix && <Text style={[styles.affix, { color: colors.textMuted }]}>{f.suffix}</Text>}
                  </View>
                </View>
              ))}
            </View>
            {hasResult && (
              <View style={[styles.resultCard, { backgroundColor: colors.primaryContainer, borderColor: colors.primary + '40' }]}>
                <Text style={[styles.resultTitle, { color: colors.primaryDark }]}>Summary</Text>
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Base Amount</Text>
                  <Text style={[styles.summaryValue, { color: colors.primaryDark }]}>{`\u20b9 ${baseAmount.toFixed(2)}`}</Text>
                </View>
                {extra > 0 && (
                  <View style={styles.summaryRow}>
                    <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>Extra kg Amount</Text>
                    <Text style={[styles.summaryValue, { color: colors.primaryDark }]}>{`\u20b9 ${extraAmount.toFixed(2)}`}</Text>
                  </View>
                )}
                <View style={[styles.divider, { backgroundColor: colors.primary + '30' }]} />
                <View style={styles.summaryRow}>
                  <Text style={[styles.totalLabel, { color: colors.primaryDark }]}>Total Amount</Text>
                  <Text style={[styles.totalValue, { color: colors.primary }]}>{`\u20b9 ${totalAmount.toFixed(2)}`}</Text>
                </View>
              </View>
            )}
            {(quantity || ratePerUnit || extraKg || extraKgRate) ? (
              <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.border }]} onPress={resetCalc} activeOpacity={0.7}>
                <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
                <Text style={[styles.resetText, { color: colors.textMuted }]}>Reset</Text>
              </TouchableOpacity>
            ) : null}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  const ListData = [
    { key: 'welcome' },
    { key: 'services' },
    { key: 'seasonal' },
    { key: 'schemes' },
  ];

  const renderItem = ({ item }: { item: { key: string } }) => {
    switch (item.key) {
      case 'welcome':   return WelcomeCard;
      case 'services':  return ServicesSection;
      case 'seasonal':  return SeasonalAdvisory;
      case 'schemes':   return GovernmentSchemes;
      default:          return null;
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.primary }]}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)')} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Ionicons name="leaf" size={20} color="#FFF" style={{ marginRight: 6 }} />
          <Text style={styles.headerTitle}>Krushi Mitra</Text>
        </View>
        <TouchableOpacity style={styles.notifBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="notifications-outline" size={22} color="#FFF" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={[styles.searchWrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: colors.text }]}
          placeholder="Search services..."
          placeholderTextColor={colors.textMuted}
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      {/* Traction Booking Modal */}
      <Modal visible={showTraction} transparent animationType="slide" onRequestClose={() => { setShowTraction(false); resetTraction(); }}>
        <TouchableWithoutFeedback onPress={() => { setShowTraction(false); resetTraction(); }}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalSheet}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, { backgroundColor: '#F57F1718' }]}>
                <Ionicons name="construct-outline" size={22} color="#F57F17" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Book Traction</Text>
              <TouchableOpacity onPress={() => { setShowTraction(false); resetTraction(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            {tractionBooked ? (
              /* ── Confirmation screen ── */
              <View style={styles.tractionConfirm}>
                <View style={styles.tractionConfirmIcon}>
                  <Ionicons name="checkmark-circle" size={64} color="#F57F17" />
                </View>
                <Text style={[styles.tractionConfirmTitle, { color: colors.text }]}>Booking Confirmed!</Text>
                <Text style={[styles.tractionConfirmSub, { color: colors.textSecondary }]}>
                  Your {tractorType} tractor has been booked for {tractorDate} on {tractorArea} acres.
                </Text>
                <View style={[styles.tractionConfirmCard, { backgroundColor: '#FFF8E1', borderColor: '#F57F1740' }]}>
                  <View style={styles.tractionConfirmRow}>
                    <Ionicons name="construct-outline" size={16} color="#F57F17" />
                    <Text style={styles.tractionConfirmLabel}>Tractor Type</Text>
                    <Text style={styles.tractionConfirmValue}>{tractorType}</Text>
                  </View>
                  <View style={[styles.divider, { backgroundColor: '#F57F1720' }]} />
                  <View style={styles.tractionConfirmRow}>
                    <Ionicons name="map-outline" size={16} color="#F57F17" />
                    <Text style={styles.tractionConfirmLabel}>Area</Text>
                    <Text style={styles.tractionConfirmValue}>{tractorArea} acres</Text>
                  </View>
                  <View style={[styles.divider, { backgroundColor: '#F57F1720' }]} />
                  <View style={styles.tractionConfirmRow}>
                    <Ionicons name="calendar-outline" size={16} color="#F57F17" />
                    <Text style={styles.tractionConfirmLabel}>Date</Text>
                    <Text style={styles.tractionConfirmValue}>{tractorDate}</Text>
                  </View>
                </View>
                <TouchableOpacity
                  style={[styles.calcBtn, { backgroundColor: '#F57F17', marginTop: 8 }]}
                  onPress={() => { setShowTraction(false); resetTraction(); }}
                  activeOpacity={0.8}
                >
                  <Ionicons name="checkmark-outline" size={18} color="#FFF" />
                  <Text style={styles.calcBtnText}>Done</Text>
                </TouchableOpacity>
              </View>
            ) : (
              /* ── Booking form ── */
              <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={[styles.calcCard, { backgroundColor: colors.background, borderColor: colors.border }]}>

                  {/* Tractor type selector */}
                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tractor Type</Text>
                    <View style={styles.tractionTypeRow}>
                      {(['Mini', '2WD', '4WD'] as const).map((t) => (
                        <TouchableOpacity
                          key={t}
                          onPress={() => setTractorType(t)}
                          style={[styles.tractionTypeBtn, { borderColor: tractorType === t ? '#F57F17' : colors.border, backgroundColor: tractorType === t ? '#FFF8E1' : colors.surface }]}
                        >
                          <Ionicons name="construct-outline" size={18} color={tractorType === t ? '#F57F17' : colors.textMuted} />
                          <Text style={[styles.tractionTypeBtnText, { color: tractorType === t ? '#F57F17' : colors.textSecondary }]}>{t}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>

                  {/* Area */}
                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Field Area (acres)</Text>
                    <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="map-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        style={[styles.calcInput, { color: colors.text }]}
                        placeholder="e.g. 3"
                        placeholderTextColor={colors.textMuted}
                        keyboardType="numeric"
                        value={tractorArea}
                        onChangeText={setTractorArea}
                      />
                      <Text style={[styles.affix, { color: colors.textMuted }]}>acres</Text>
                    </View>
                  </View>

                  {/* Date */}
                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Preferred Date</Text>
                    <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                      <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
                      <TextInput
                        style={[styles.calcInput, { color: colors.text }]}
                        placeholder="DD/MM/YYYY"
                        placeholderTextColor={colors.textMuted}
                        value={tractorDate}
                        onChangeText={setTractorDate}
                      />
                    </View>
                  </View>

                  {/* Notes */}
                  <View style={styles.fieldWrap}>
                    <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Notes <Text style={{ fontWeight: '400', fontSize: 11 }}>(optional)</Text></Text>
                    <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border, alignItems: 'flex-start', paddingVertical: 10 }]}>
                      <Ionicons name="create-outline" size={16} color={colors.textMuted} style={{ marginTop: 2 }} />
                      <TextInput
                        style={[styles.calcInput, { color: colors.text, minHeight: 56 }]}
                        placeholder="Any special instructions..."
                        placeholderTextColor={colors.textMuted}
                        multiline
                        value={tractorNotes}
                        onChangeText={setTractorNotes}
                      />
                    </View>
                  </View>
                </View>

                <TouchableOpacity
                  style={[styles.calcBtn, { backgroundColor: '#F57F17', opacity: tractorArea && tractorDate ? 1 : 0.45 }]}
                  onPress={bookTraction}
                  activeOpacity={0.8}
                  disabled={!tractorArea || !tractorDate}
                >
                  <Ionicons name="construct-outline" size={18} color="#FFF" />
                  <Text style={styles.calcBtnText}>Book Tractor</Text>
                </TouchableOpacity>
              </ScrollView>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {PriceCalculatorModal}

      {/* Pesticide Calculator Modal */}
      <Modal visible={showPesticideCalc} transparent animationType="slide" onRequestClose={() => setShowPesticideCalc(false)}>
        <TouchableWithoutFeedback onPress={() => setShowPesticideCalc(false)}>
          <View style={styles.modalOverlay} />
        </TouchableWithoutFeedback>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalSheet}>
          <View style={[styles.modalContent, { backgroundColor: colors.surface }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />

            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, { backgroundColor: '#00695C18' }]}>
                <Ionicons name="flask-outline" size={22} color="#00695C" />
              </View>
              <Text style={[styles.modalTitle, { color: colors.text }]}>Pesticide Calculator</Text>
              <TouchableOpacity onPress={() => { setShowPesticideCalc(false); resetPesticide(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={22} color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={[styles.calcCard, { backgroundColor: colors.background, borderColor: colors.border }]}>

                {/* Field Area */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Field Area (acres)</Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="map-outline" size={16} color={colors.textMuted} />
                    <TextInput
                      style={[styles.calcInput, { color: colors.text }]}
                      placeholder="e.g. 2"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={pesticideArea}
                      onChangeText={(v) => { setPesticideArea(v); setPesticideResult(null); }}
                    />
                    <Text style={[styles.affix, { color: colors.textMuted }]}>acres</Text>
                  </View>
                </View>

                {/* Dose with unit toggle */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Pesticide Dose per acre</Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="flask-outline" size={16} color={colors.textMuted} />
                    <TextInput
                      style={[styles.calcInput, { color: colors.text }]}
                      placeholder="e.g. 200"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={pesticideDose}
                      onChangeText={(v) => { setPesticideDose(v); setPesticideResult(null); }}
                    />
                    {/* ml / g toggle */}
                    <View style={styles.unitToggle}>
                      {(['ml', 'g'] as const).map((u) => (
                        <TouchableOpacity
                          key={u}
                          onPress={() => { setPesticideUnit(u); setPesticideResult(null); }}
                          style={[styles.unitBtn, pesticideUnit === u && { backgroundColor: '#00695C' }]}
                        >
                          <Text style={[styles.unitBtnText, pesticideUnit === u && { color: '#FFF' }]}>{u}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>

                {/* Water */}
                <View style={styles.fieldWrap}>
                  <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Water per acre (litres) <Text style={{ fontWeight: '400', fontSize: 11 }}>(optional)</Text></Text>
                  <View style={[styles.inputRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                    <Ionicons name="water-outline" size={16} color={colors.textMuted} />
                    <TextInput
                      style={[styles.calcInput, { color: colors.text }]}
                      placeholder="e.g. 200"
                      placeholderTextColor={colors.textMuted}
                      keyboardType="numeric"
                      value={pesticideWater}
                      onChangeText={(v) => { setPesticideWater(v); setPesticideResult(null); }}
                    />
                    <Text style={[styles.affix, { color: colors.textMuted }]}>L</Text>
                  </View>
                </View>
              </View>

              {/* Calculate button */}
              <TouchableOpacity
                style={[styles.calcBtn, { backgroundColor: '#00695C', opacity: pesticideArea && pesticideDose ? 1 : 0.45 }]}
                onPress={calcPesticide}
                activeOpacity={0.8}
                disabled={!pesticideArea || !pesticideDose}
              >
                <Ionicons name="calculator-outline" size={18} color="#FFF" />
                <Text style={styles.calcBtnText}>Calculate</Text>
              </TouchableOpacity>

              {/* Result */}
              {pesticideResult && (
                <View style={[styles.resultCard, { backgroundColor: '#E8F5E9', borderColor: '#00695C40' }]}>
                  <Text style={[styles.resultTitle, { color: '#00695C' }]}>Result</Text>

                  <View style={styles.pesticideResultRow}>
                    <View style={[styles.pesticideResultIcon, { backgroundColor: '#00695C18' }]}>
                      <Ionicons name="flask" size={20} color="#00695C" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.summaryLabel, { color: '#555' }]}>Total Pesticide Needed</Text>
                      <Text style={[styles.pesticideResultValue, { color: '#00695C' }]}>
                        {pesticideResult.qty} {pesticideUnit}
                      </Text>
                    </View>
                  </View>

                  {pesticideResult.water ? (
                    <>
                      <View style={[styles.divider, { backgroundColor: '#00695C30' }]} />
                      <View style={styles.pesticideResultRow}>
                        <View style={[styles.pesticideResultIcon, { backgroundColor: '#0288D118' }]}>
                          <Ionicons name="water" size={20} color="#0288D1" />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.summaryLabel, { color: '#555' }]}>Total Water Needed</Text>
                          <Text style={[styles.pesticideResultValue, { color: '#0288D1' }]}>
                            {pesticideResult.water} L
                          </Text>
                        </View>
                      </View>
                    </>
                  ) : null}

                  <View style={[styles.pesticideHint, { backgroundColor: '#00695C10' }]}>
                    <Ionicons name="information-circle-outline" size={14} color="#00695C" />
                    <Text style={styles.pesticideHintText}>Always follow label instructions. Wear protective gear.</Text>
                  </View>
                </View>
              )}

              {(pesticideArea || pesticideDose || pesticideWater) ? (
                <TouchableOpacity style={[styles.resetBtn, { borderColor: colors.border }]} onPress={resetPesticide} activeOpacity={0.7}>
                  <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.resetText, { color: colors.textMuted }]}>Reset</Text>
                </TouchableOpacity>
              ) : null}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Content */}
      <FlatList
        data={ListData}
        keyExtractor={(item) => item.key}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false })}
        scrollEventThrottle={16}
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  notifBtn: { width: 40, alignItems: 'flex-end' },
  headerCenter: { flexDirection: 'row', alignItems: 'center' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: '800', letterSpacing: -0.3 },

  // Search
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, padding: 0 },

  scroll: { paddingHorizontal: 16, paddingTop: 16 },

  // Welcome Card
  welcomeCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    flexDirection: 'column',
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#1B5E20', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 6 },
    }),
  },
  welcomeTopRow: { flexDirection: 'row', alignItems: 'center' },
  wCircle1: {
    position: 'absolute', width: 120, height: 120, borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.07)', top: -30, right: 60,
  },
  wCircle2: {
    position: 'absolute', width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(255,255,255,0.05)', bottom: -20, right: 10,
  },
  welcomeLeft: { flex: 1 },
  welcomeTitle: { color: '#FFF', fontSize: 20, fontWeight: '900', lineHeight: 26, letterSpacing: -0.4 },
  welcomeSub: { color: 'rgba(255,255,255,0.8)', fontSize: 12, fontWeight: '500', marginTop: 6 },
  welcomeBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, marginTop: 12,
  },
  welcomeBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  welcomeRight: { marginLeft: 12 },
  farmIllustration: { alignItems: 'center', gap: 6 },
  farmIconRow: { flexDirection: 'row', alignItems: 'center' },
  weatherBubble: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 2,
  },
  weatherTemp: { color: '#FFF', fontSize: 20, fontWeight: '900', lineHeight: 24 },
  weatherCond: { color: 'rgba(255,255,255,0.85)', fontSize: 10, fontWeight: '600', textAlign: 'center' },

  // Forecast strip inside Welcome card
  forecastStrip: {
    flexDirection: 'row',
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 14,
    paddingVertical: 10,
  },
  forecastStripItem: { flex: 1, alignItems: 'center', paddingHorizontal: 4 },
  forecastStripBorder: { borderRightWidth: 1, borderRightColor: 'rgba(255,255,255,0.2)' },
  forecastStripDay: { color: 'rgba(255,255,255,0.9)', fontSize: 11, fontWeight: '700' },
  forecastStripTemps: { color: '#FFF', fontSize: 11, fontWeight: '700', marginTop: 2 },
  forecastStripRain: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  forecastStripRainText: { color: 'rgba(255,255,255,0.75)', fontSize: 10, fontWeight: '600' },

  // Section Title
  sectionTitle: { fontSize: 15, fontWeight: '700', letterSpacing: -0.2, marginBottom: 12 },

  // Services — horizontal pills
  servicesList: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  servicePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.07)' } as any,
    }),
  },
  servicePillIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  servicePillLabel: { fontSize: 13, fontWeight: '700' },
  servicePillArrow: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  // Seasonal Advisory
  seasonalCard: {
    borderRadius: 18,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  seasonalHeader: { marginBottom: 8 },
  seasonalBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20,
  },
  seasonalBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
  seasonalTitle: { fontSize: 16, fontWeight: '800', marginBottom: 12, letterSpacing: -0.3 },
  tipRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  tipDot: { width: 6, height: 6, borderRadius: 3 },
  tipText: { fontSize: 13, flex: 1, lineHeight: 18 },
  learnMoreBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, marginTop: 4,
  },
  learnMoreText: { color: '#FFF', fontSize: 13, fontWeight: '700' },

  // Government Schemes — horizontal pills (same as services)
  schemesList: { flexDirection: 'row', gap: 10, paddingRight: 4 },
  schemePill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 50,
    paddingVertical: 10,
    paddingHorizontal: 14,
    gap: 8,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0px 2px 8px rgba(0,0,0,0.07)' } as any,
    }),
  },
  schemePillIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  schemePillLabel: { fontSize: 13, fontWeight: '700' },



  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  modalSheet: { justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 32, maxHeight: '90%' },
  modalHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  modalIconWrap: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '800' },
  calcCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 14, marginBottom: 14 },
  fieldWrap: { gap: 6 },
  fieldLabel: { fontSize: 13, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, gap: 6 },
  calcInput: { flex: 1, fontSize: 15, padding: 0 },
  affix: { fontSize: 13, fontWeight: '600' },
  resultCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 10, marginBottom: 14 },
  resultTitle: { fontSize: 14, fontWeight: '700', marginBottom: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryLabel: { fontSize: 13 },
  summaryValue: { fontSize: 13, fontWeight: '700' },
  divider: { height: 1, marginVertical: 4 },
  totalLabel: { fontSize: 16, fontWeight: '800' },
  totalValue: { fontSize: 20, fontWeight: '900' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1, marginBottom: 8 },
  resetText: { fontSize: 13, fontWeight: '600' },

  // Pesticide Calculator
  unitToggle: { flexDirection: 'row', borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#00695C40' },
  unitBtn: { paddingHorizontal: 10, paddingVertical: 5 },
  unitBtnText: { fontSize: 12, fontWeight: '700', color: '#00695C' },
  calcBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 14, borderRadius: 14, marginBottom: 14,
  },
  calcBtnText: { color: '#FFF', fontSize: 15, fontWeight: '800' },
  pesticideResultRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pesticideResultIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pesticideResultValue: { fontSize: 22, fontWeight: '900', marginTop: 2 },
  pesticideHint: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 10, padding: 10, borderRadius: 10,
  },
  pesticideHintText: { fontSize: 11, color: '#00695C', flex: 1, lineHeight: 16 },

  // Traction Booking
  tractionTypeRow: { flexDirection: 'row', gap: 10 },
  tractionTypeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
  },
  tractionTypeBtnText: { fontSize: 13, fontWeight: '700' },
  tractionConfirm: { alignItems: 'center', paddingVertical: 8, paddingBottom: 16 },
  tractionConfirmIcon: { marginBottom: 12 },
  tractionConfirmTitle: { fontSize: 20, fontWeight: '900', marginBottom: 6 },
  tractionConfirmSub: { fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 16, paddingHorizontal: 8 },
  tractionConfirmCard: { width: '100%', borderRadius: 14, borderWidth: 1, padding: 14, gap: 10, marginBottom: 8 },
  tractionConfirmRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tractionConfirmLabel: { flex: 1, fontSize: 13, color: '#888' },
  tractionConfirmValue: { fontSize: 13, fontWeight: '700', color: '#F57F17' },
});
