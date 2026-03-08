# Промт для редизайна Admin Dashboard Chatbot24

## Цель
Создать современный, профессиональный дизайн админ-панели аналитики для SaaS-продукта. Дизайн должен вызывать доверие, быть функциональным и визуально привлекательным для sales-менеджеров и владельцев бизнеса.

---

## 1. Визуальный стиль

### Цветовая палитра (рекомендуется)
**Основные цвета:**
- Primary: `#6366F1` (Indigo-500) — основной акцент
- Primary Dark: `#4F46E5` (Indigo-600) — hover состояния
- Background: `#0F172A` (Slate-900) — тёмный фон
- Surface: `#1E293B` (Slate-800) — карточки
- Surface Elevated: `#334155` (Slate-700) — поднятые элементы

**Семантические цвета:**
- Success: `#10B981` (Emerald-500) — конверсия, лиды
- Warning: `#F59E0B` (Amber-500) — теплые лиды
- Danger: `#EF4444` (Red-500) — эскалации, горячие срочно
- Info: `#3B82F6` (Blue-500) — нейтральная информация

**Текст:**
- Text Primary: `#F8FAFC` (Slate-50)
- Text Secondary: `#94A3B8` (Slate-400)
- Text Muted: `#64748B` (Slate-500)

### Градиенты
- Header: `linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)`
- Cards hover: subtle glow с primary цветом
- Charts: градиентная заливка под линиями

---

## 2. Типографика

### Шрифты
- **Primary**: Inter (Google Fonts)
- **Monospace**: JetBrains Mono (для чисел, дат)
- **Fallback**: system-ui, -apple-system, sans-serif

### Размеры
- Dashboard Title: `text-2xl font-bold tracking-tight`
- Section Title: `text-lg font-semibold`
- Card Title: `text-sm font-medium text-slate-400 uppercase tracking-wider`
- Metric Value: `text-3xl font-bold tabular-nums`
- Body: `text-sm leading-relaxed`

---

## 3. Layout структура

```
┌────────────────────────────────────────────────────────────┐
│ Sidebar (64px) │  Main Content Area                         │
│                │  ┌─────────────────────────────────────┐  │
│  🏠            │  │ Header with Title + Actions         │  │
│  📊            │  │ [Period Selector] [Export] [⚙️]     │  │
│  ⚙️            │  └─────────────────────────────────────┘  │
│                │  ┌─────────────────────────────────────┐  │
│                │  │ Stats Cards Row (4 cols)            │  │
│                │  │ [🗨️] [👥] [📈] [⚠️]                 │  │
│                │  └─────────────────────────────────────┘  │
│                │  ┌─────────────────────────────────────┐  │
│                │  │ Main Chart (Activity Line)          │  │
│                │  │ with gradient fill                  │  │
│                │  └─────────────────────────────────────┘  │
│                │  ┌─────────────┐ ┌─────────────────────┐  │
│                │  │ Conversion  │ │ Sentiment Pie       │  │
│                │  │ Funnel      │ │                     │  │
│                │  └─────────────┘ └─────────────────────┘  │
│                │  ┌─────────────────────────────────────┐  │
│                │  │ Leads Table with filters            │  │
│                │  └─────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Компоненты

### 4.1 Stats Cards
**Дизайн:**
- Фон: Surface цвет с subtle border (`border-slate-700`)
- Border-radius: `rounded-xl` (12px)
- Padding: `p-6`
- Shadow: `shadow-lg shadow-slate-900/20`
- Hover: `hover:shadow-xl hover:border-indigo-500/30` + lift на 2px

**Содержимое:**
```
┌─────────────────────────────┐
│ 🗨️  ВСЕГО ДИАЛОГОВ         │  ← icon + label (uppercase, muted)
│                             │
│ 1,247              ▲ 12%   │  ← value (large) + trend
│ ───────────────             │  ← sparkline mini-chart
│ последние 7 дней            │  ← subtitle
└─────────────────────────────┘
```

**Тренд индикатор:**
- Рост: `text-emerald-400` + стрелка вверх
- Падение: `text-rose-400` + стрелка вниз
- Нейтрально: `text-slate-400`

**Sparkline:**
- SVG line chart без осей
- Stroke: primary цвет, 2px
- Fill: gradient с прозрачностью 20%
- Height: 40px

### 4.2 Графики

**Line Chart (Активность):**
- Stroke: gradient от primary к secondary
- Stroke width: 3px
- Fill: gradient под линией (opacity 0.1 → 0)
- Точки: hover появляются с тултипом
- Grid: subtle dashed lines (`stroke-slate-700`)
- Axes: `text-slate-400`, без жирных линий

**Funnel Chart (Конверсия):**
```
Просмотры    ████████████  10,000  100%
  Диалоги    ████████      5,200   52%
   Лиды      ████          1,240   24%
    HOT      ██            320     6%
```
- Горизонтальные полосы с закруглением
- Цвета: от indigo к emerald
- Labels слева, числа справа
- Процент конверсии между этапами

**Pie Charts:**
- Donut style (inner radius 60%)
- Stroke width: 0
- Padding между сегментами: 2px
- Center label с общим числом
- Legend справа/снизу

### 4.3 Leads Table

**Header:**
- Sticky при скролле
- Фон: Surface Elevated
- Текст: uppercase, tracking-wider, muted

**Row:**
- Border-bottom: subtle (`border-slate-800`)
- Hover: `bg-slate-800/50` + cursor pointer
- Transition: 150ms ease

**Status Badges:**
```
┌─────────────┬─────────────┬─────────────┐
│   🔥 HOT    │   🟡 WARM   │   🔵 COLD   │
│  bg-rose-   │  bg-amber-  │  bg-blue-   │
│  500/20     │  500/20     │  500/20     │
│  text-rose  │  text-amber │  text-blue  │
│  -400       │  -400       │  -400       │
└─────────────┴─────────────┴─────────────┘
```

**Actions:**
- Quick view: eye icon
- Edit: pencil icon
- Delete: trash icon (только на hover)

### 4.4 Period Selector
- Segmented control (как iOS)
- Active: `bg-indigo-500 text-white`
- Inactive: `text-slate-400 hover:text-white`
- Background: `bg-slate-800`
- Padding: `p-1`
- Gap: 4px

---

## 5. Анимации и взаимодействия

### 5.1 Page Load
- Staggered entrance: карточки появляются с интервалом 50ms
- Animation: `opacity 0→1, translateY 20px→0`
- Duration: 400ms
- Easing: `cubic-bezier(0.4, 0, 0.2, 1)`

### 5.2 Hover Effects
**Cards:**
- Transform: `translateY(-2px)`
- Shadow: increase
- Border: добавление primary color с 30% opacity
- Duration: 200ms

**Buttons:**
- Scale: `1.02`
- Background: darken/lighten на 10%
- Duration: 150ms

### 5.3 Data Updates
- Number count-up animation при изменении значений
- Duration: 800ms
- Easing: `ease-out`

### 5.4 Loading States
- Skeleton screens вместо spinners
- Shimmer effect: `linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)`
- Animation: бесконечный loop 1.5s

### 5.5 Table Row Hover
- Background: плавное изменение
- Action buttons: появление с fade-in
- Duration: 150ms

---

## 6. Адаптивность

### Desktop (1280px+)
- Sidebar: 240px expanded / 64px collapsed
- Stats: 4 колонки
- Charts: side-by-side

### Tablet (768px - 1279px)
- Sidebar: только иконки (64px)
- Stats: 2 колонки
- Charts: stack vertically

### Mobile (< 768px)
- Sidebar: hidden, hamburger menu
- Stats: 1 колонка, scrollable horizontally
- Charts: full width, stacked
- Table: horizontal scroll с fade indicators

---

## 7. UX-улучшения

### 7.1 Quick Actions
- Floating action button (FAB) для быстрого экспорта
- Keyboard shortcuts: `E` — export, `R` — refresh, `/` — search
- Toast notifications для actions (success/error)

### 7.2 Empty States
- Иллюстрации (SVG) для пустых данных
- CTA button для начала работы
- Help text с инструкцией

### 7.3 Filtering
- Global search в шапке
- Date range picker с presets (Today, Yesterday, Last 7 days, etc.)
- Filters sidebar (slide-in panel)

### 7.4 Real-time Indicators
- Live dot (pulsing green) для real-time данных
- "Updated X seconds ago" текст
- Auto-refresh toggle

---

## 8. Дополнительные фичи

### 8.1 Dark/Light Mode Toggle
- Toggle switch в header
- System preference detection
- Smooth transition между темами (300ms)

### 8.2 Customizable Dashboard
- Drag-and-drop для карточек
- Show/hide widgets
- Save layout per user

### 8.3 Data Export
- Dropdown: CSV, Excel, PDF
- Date range selection before export
- Email delivery option

---

## 9. Технические требования

- CSS Framework: Tailwind CSS
- Icons: Lucide React
- Charts: Recharts (кастомные темы)
- Fonts: Inter (Google Fonts)
- Animations: Framer Motion (optional) или CSS transitions

---

## 10. Контрольный список

- [ ] Все компоненты используют новую цветовую схему
- [ ] Присутствуют все hover и active состояния
- [ ] Анимации работают плавно (60fps)
- [ ] Адаптивность проверена на 320px, 768px, 1440px
- [ ] Контрастность текста соответствует WCAG AA
- [ ] Toast notifications настроены
- [ ] Loading states реализованы
- [ ] Keyboard navigation работает
