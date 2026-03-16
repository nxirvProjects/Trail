# Job Application Tracker

A Chrome extension for tracking job applications with advanced gamification features to keep you motivated during your job search.

## Features

### 📝 Application Management
- **Quick Logging**: Log applications with company name, role, and URL
- **Floating Button**: Toggle-enabled floating button on all web pages for instant logging
  - **Dynamic Badge Icon**: Button icon changes to reflect your current daily rank (Bronze 🥉, Silver 🥈, Gold 🥇, etc.)
  - **Dynamic Colors**: Button background color matches your daily badge rank
  - **Glow Effects**: Higher ranks get special glow effects on the floating button
- **Auto-Extraction**: Automatically extracts company and role from job boards:
  - LinkedIn
  - Indeed
  - Greenhouse
  - Lever
  - Workday
- **Search & Filter**: Search applications by company or role
- **Edit & Delete**: Manage your application history
- **CSV Import/Export**: Back up and restore your data

### 🎮 Gamification Features

#### 🏆 Daily Badge System
- Earn badges based on applications submitted today (resets daily)
- Badge tiers:
  - **No Badge** (0 apps): 📝 Gray
  - **Bronze** (1+ apps): 🥉 Orange
  - **Silver** (3+ apps): 🥈 Silver
  - **Gold** (5+ apps): 🥇 Gold
  - **Platinum** (8+ apps): 💎 Purple
  - **Diamond** (10+ apps): 💠 Cyan
  - **Legendary** (15+ apps): ⚡ Purple
- Displayed in header with glowing effects
- Floating button icon and color reflects your current daily badge!

#### 📊 Level & XP System
- Earn **10 base XP per application**
- **Streak multipliers boost XP gains**:
  - 1-6 days: 1.0x (10 XP)
  - 7-13 days: 1.5x (15 XP)
  - 14-29 days: 2.0x (20 XP)
  - 30+ days: 3.0x (30 XP!)
- Level up every 100 XP
- Progress bar shows current level advancement
- Level titles:
  - Beginner Job Hunter (1-4)
  - Active Applicant (5-9)
  - Job Search Pro (10-19)
  - Application Master (20-29)
  - Career Seeker Elite (30-49)
  - Legendary Job Hunter (50)

#### ⭐ Prestige System
- Prestige every 5000 XP (50 levels)
- Level resets but you earn prestige stars
- Infinite progression system
- Stars displayed next to level title with golden glow

#### 🔥 Streak Counter
- Tracks consecutive days of applying
- Breaks if you skip more than 1 day
- Fire icon grows and glows based on streak length:
  - 7+ days: 1.5x XP multiplier + enhanced glow
  - 14+ days: 2.0x XP multiplier + stronger glow
  - 30+ days: 3.0x XP multiplier + maximum glow effect
- Displays longest streak achieved

#### 📅 Weekly Performance System
- Tracks applications per week
- **Weekly Penalties**: Lose 5 XP per application if you apply to fewer jobs than last week
- **Weekly Bonuses**: Gain 3 XP per application if you improve over last week
- Automatically checks performance once per week
- Encourages consistent weekly application volume

#### 📜 Activity Log
- Complete history of your gamification journey
- Tracks:
  - **XP Gains**: Every XP award with streak multipliers shown
  - **Level Ups**: When you reach new levels
  - **Weekly Penalties**: XP lost due to reduced performance
  - **Weekly Bonuses**: XP gained for improved performance
- Shows last 50 activities with timestamps
- Color-coded entries:
  - ✨ XP gains (gold glow)
  - 🎉 Level ups (purple glow)
  - ⚠️ Penalties (red glow)
  - 🎁 Bonuses (green glow)
- Displays XP changes with +/- badges

#### 📈 Application Stats
- **This Week**: Applications in the current week
- **This Month**: Applications in the current month
- **Weekly Average**: Average applications per week since you started
- **Total**: Total applications logged

### 🔗 My Links
- Save frequently used links (job boards, company pages, etc.)
- Quick access to important URLs
- Copy links to clipboard with one click

### ⚙️ Settings
- **Quick Log Button Toggle**: Enable/disable the floating button
- **Clear All Data**: Reset all applications and stats (Danger Zone)
  - Your saved links will be preserved
  - Requires confirmation before deletion

## Installation

1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top right
4. Click "Load unpacked"
5. Select the Job_Logger folder

## Usage

### Logging Applications

**Method 1: Manual Log**
1. Click the extension icon
2. Click "+ Log Current"
3. Enter company name and role
4. Application is saved with current URL
5. XP is awarded based on your current streak!

**Method 2: Floating Button**
1. Enable "Quick Log Button" toggle in Settings
2. Navigate to a job posting page
3. Click the floating badge button on the page (icon changes based on daily rank!)
4. If on a supported job board, details auto-fill
5. Otherwise, manually enter company and role
6. Watch the button update its icon and color as you earn daily badges!

### Viewing Stats & Progress
1. Click the extension icon
2. Navigate to the "Stats" tab
3. View your:
   - Current level, XP, and prestige
   - Current and longest streak
   - Daily badge with app count
   - Weekly and monthly statistics
   - Complete activity log

### Managing Links
1. Click the extension icon
2. Navigate to the "My Links" tab
3. Click "+ Add New Link" to save a link
4. Use the copy button to copy links to clipboard

### Settings
1. Click the extension icon
2. Navigate to the "Settings" tab
3. Toggle the floating button on/off
4. Access the Danger Zone to clear all data

### Import/Export Data
- **Export**: Click "Export CSV" to download your application data
- **Import**: Click "Import CSV" and select a previously exported file
- Stats and XP automatically migrate for existing users

## Data Storage

All data is stored locally using Chrome's storage API:
- Applications list
- Saved links
- Gamification progress:
  - Level, XP, prestige
  - Current and longest streak
  - Total XP earned
  - Weekly statistics (last 12 weeks)
  - Activity log (last 50 entries)

Data syncs across your Chrome browsers when signed in to the same Google account.

## Privacy

- No data is sent to external servers
- All data stays in your Chrome storage
- URLs are only stored locally for your reference

## Technical Details

- **Manifest Version**: 3
- **Permissions**: storage, activeTab, scripting
- **Content Scripts**: Injected on all URLs for floating button functionality with dynamic badge styling
- **Browser**: Chrome (Chromium-based browsers)
- **UI/UX**: Custom modal system replaces native browser alerts

## Development

### File Structure
```
Job_Logger/
├── manifest.json       # Extension configuration
├── popup.html          # Main UI (4 tabs: Applications, Links, Stats, Settings)
├── popup.js            # Core logic, gamification, and XP system
├── styles.css          # Complete styling including activity log
├── content.js          # Floating button, auto-extraction, and dynamic badge styling
├── content.css         # Floating button styling
├── icons/              # Extension icons (16px, 48px, 128px)
└── README.md           # Documentation
```

### Key Functions

#### popup.js
- `loadData()`: Loads applications, links, and gamification state with migration
- `saveApplications()`: Saves applications and updates UI
- `updateLevelAndXP()`: Calculates level, XP, and prestige from totalXPEarned
- `getStreakMultiplier()`: Returns XP multiplier based on current streak
- `awardXP()`: Awards XP with streak multipliers and logs activity
- `addActivityLog()`: Adds entries to activity log (max 50)
- `checkWeeklyAverage()`: Checks weekly performance and applies penalties/bonuses
- `updateStreak()`: Calculates consecutive day streak
- `calculateDailyBadge()`: Determines today's badge tier
- `renderActivityLog()`: Displays activity log in Stats tab
- `getTimeAgo()`: Formats timestamps for activity log

#### content.js
- `extractJobDetails()`: Auto-extracts job info from supported sites
- `getDailyBadge()`: Calculates current daily badge based on today's applications
- `updateFloatingButtonAppearance()`: Updates button icon, color, and glow based on daily badge
- `saveApplicationDirect()`: Saves application with streak update and XP award
- `awardXP()`: Awards XP with streak multipliers (mirrored from popup.js)

## Recent Updates

### Latest Features (v3.0)
- ✅ **Streak-Based XP Multipliers**: Earn up to 3x XP with 30+ day streaks!
- ✅ **Weekly Performance System**: Penalties for reduced performance, bonuses for improvement
- ✅ **Activity Log**: Complete history of XP gains, level ups, and penalties/bonuses
- ✅ **Dynamic Floating Button**: Icon and color changes based on daily badge rank
- ✅ **Settings Tab**: New dedicated tab for settings and danger zone
- ✅ **XP System Overhaul**: Migrated from derived XP to earned XP tracking

### Previous Updates
- ✅ **Custom Modal System**: Replaced native browser alerts with styled custom modals
- ✅ **Clear All Data**: Added ability to reset applications and stats
- ✅ **Extension Icons**: Added proper Chrome extension icons
- ✅ **Streak Bug Fixes**: Fixed longest streak incrementing incorrectly
- ✅ **CSV Import Improvements**: Stats properly recalculate when importing

## Gamification Philosophy

This extension uses game mechanics to encourage consistent job application behavior:

1. **Daily Badges**: Encourage applying to multiple jobs per day
2. **Streaks**: Reward applying every single day with XP multipliers
3. **Weekly System**: Encourage maintaining or improving weekly application volume
4. **Activity Log**: Provide transparency and feedback on your progress
5. **Dynamic Floating Button**: Visual feedback that evolves as you progress each day

The combination creates a positive feedback loop that turns job searching from a chore into a game!

## Future Enhancements

- Application status tracking (applied, interviewing, rejected, offer)
- Interview date reminders
- Application notes and follow-up tracking
- More job board integrations
- Data visualization and analytics
- Achievements and milestones system


## License

MIT License - Feel free to use and modify as needed.
