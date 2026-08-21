const STORAGE_KEY = 'tpocket_shioris';

const sampleShioris = [
  {
    id: 'guam-2026',
    title: 'グアム3泊4日 🌴 Beach & BBQ',
    destination: 'グアム',
    dates: '2026.09.10 - 09.13',
    headerImg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    days: [
      {
        dayNum: 1,
        title: 'Day 1: 到着 & ビーチBBQ',
        spots: [
          {
            id: 's1',
            time: '10:00',
            title: 'グアム国際空港 到着',
            memo: '入国審査書類の書き方に注意！税関申告アプリ準備済み。',
            isAfter: false,
            beforeImg: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=600&q=80',
            afterImg: '',
            reserveLink: 'https://www.guamairport.com/'
          },
          {
            id: 's2',
            time: '12:30',
            title: 'ランチ: グアムリーフホテル Reef BBQ',
            memo: 'オーシャンビュー席で乾杯🍺 予約番号 #GF-8821',
            isAfter: true,
            beforeImg: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80',
            afterImg: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80',
            reserveLink: 'https://guamreef.com'
          }
        ]
      },
      { dayNum: 2, title: 'Day 2: マリンアクティビティ', spots: [] },
      { dayNum: 3, title: 'Day 3: ナイトマーケット', spots: [] }
    ]
  }
];

function getShioris() {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sampleShioris));
    return sampleShioris;
  }
  return JSON.parse(data);
}

function saveShioris(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function getShioriById(id) {
  return getShioris().find(s => s.id === id) || null;
}

let currentView = 'home', currentShioriId = null, currentDayIdx = 0, showAiAdvice = false;

function navigateTo(view, id = null) {
  currentView = view;
  currentShioriId = id;
  renderApp();
  window.scrollTo(0, 0);
}

function renderApp() {
  const container = document.getElementById('app');
  if (currentView === 'home') container.innerHTML = renderHomeScreen();
  else if (currentView === 'detail') container.innerHTML = renderDetailScreen();
}

function renderHomeScreen() {
  const list = getShioris();
  return `
    <div class="p-5">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg"><i class="fa-solid fa-plane-departure text-xl"></i></div>
          <div><h1 class="text-2xl font-black text-slate-900">TPocket</h1><p class="text-xs text-slate-500 font-medium">みんなで育てる直感旅しおり</p></div>
        </div>
        <span class="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full font-bold border border-blue-200">PWA MVP</span>
      </div>

      <button onclick="createNewShiori()" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 mb-8">
        <i class="fa-solid fa-plus"></i><span>新しい旅のしおりをつくる</span>
      </button>

      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-folder-closed text-blue-500"></i> マイポケット</h2>
        <span class="text-xs text-slate-400">${list.length}件のしおり</span>
      </div>

      <div class="space-y-4">
        ${list.map(s => `
          <div onclick="navigateTo('detail', '${s.id}')" class="bg-white border rounded-2xl overflow-hidden shadow-sm cursor-pointer">
            <div class="h-32 bg-slate-100 relative">
              <img src="${s.headerImg}" class="w-full h-full object-cover">
              <div class="absolute bottom-3 left-3 text-white">
                <span class="text-[10px] bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full font-medium">${s.destination}</span>
                <h3 class="font-bold text-base mt-1">${s.title}</h3>
              </div>
            </div>
            <div class="p-3.5 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
              <span>${s.dates}</span>
              <span class="text-blue-600 font-bold">開く →</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function createNewShiori() {
  const newId = 'shiori-' + Date.now();
  const list = getShioris();
  list.unshift({
    id: newId, title: '無題の旅行計画 ✈️', destination: '旅行先', dates: '日付未定',
    headerImg: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80',
    days: [{ dayNum: 1, title: 'Day 1', spots: [] }]
  });
  saveShioris(list);
  navigateTo('detail', newId);
}

function renderDetailScreen() {
  const shiori = getShioriById(currentShioriId);
  if (!shiori) return '<div>しおりが見つかりません</div>';
  const currentDay = shiori.days[currentDayIdx] || shiori.days[0];

  return `
    <div class="relative bg-slate-50 min-h-screen">
      <div class="sticky top-0 z-30 bg-slate-900 text-white p-3 px-4 flex items-center justify-between">
        <button onclick="navigateTo('home')" class="text-white text-xs font-bold">← 戻る</button>
        <span class="text-xs font-bold text-blue-400">TPocket</span>
        <div class="flex items-center gap-3">
          <button onclick="alert('🎵 Apple Music連携')" class="text-pink-400 text-sm"><i class="fa-solid fa-music"></i></button>
          <button onclick="alert('🔗 共有リンクをコピーしました')" class="text-blue-400 text-sm"><i class="fa-solid fa-share-nodes"></i></button>
        </div>
      </div>

      <div class="relative h-48 bg-slate-800">
        <img src="${shiori.headerImg}" class="w-full h-full object-cover">
        <div class="absolute bottom-4 left-4 text-white">
          <span class="text-[10px] bg-blue-500 px-2 py-0.5 rounded-full font-bold">${shiori.destination}</span>
          <h2 class="text-xl font-bold mt-1">${shiori.title}</h2>
        </div>
      </div>

      <div class="p-4 space-y-4 pb-28">
        ${currentDay.spots.map(spot => `
          <div class="bg-white rounded-2xl p-4 border shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold bg-slate-100 px-2.5 py-1 rounded-lg">${spot.time}</span>
              <button onclick="spot.isAfter = !spot.isAfter; saveShioris(getShioris()); renderApp();" class="text-[10px] font-bold px-2.5 py-1 rounded-full border ${spot.isAfter ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}">
                ${spot.isAfter ? '思い出写真' : '参考イメージ'}
              </button>
            </div>
            <h3 class="font-bold text-slate-800 text-sm">${spot.title}</h3>
            <div class="relative h-40 rounded-xl overflow-hidden bg-slate-100">
              <img src="${spot.isAfter ? (spot.afterImg || spot.beforeImg) : spot.beforeImg}" class="w-full h-full object-cover">
            </div>
            ${spot.memo ? `<p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">${spot.memo}</p>` : ''}
          </div>
        `).join('')}
      </div>

      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-20">
        <button onclick="openAddSpotModal()" class="w-full bg-blue-600 text-white font-bold py-3.5 rounded-2xl shadow-xl flex items-center justify-center gap-2">
          <i class="fa-solid fa-plus"></i><span>新しいスポットを追加</span>
        </button>
      </div>
    </div>
  `;
}

function openAddSpotModal() {
  const title = prompt('スポット名・予定を入力してください:');
  if (!title) return;
  const time = prompt('時間を入力してください:', '15:00');
  const list = getShioris();
  const shiori = list.find(s => s.id === currentShioriId);
  if (shiori) {
    shiori.days[currentDayIdx].spots.push({
      id: 'spot-' + Date.now(), time: time || '12:00', title: title, memo: 'メモを編集...', isAfter: false,
      beforeImg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80', afterImg: ''
    });
    saveShioris(list);
    renderApp();
  }
}

document.addEventListener('DOMContentLoaded', renderApp);