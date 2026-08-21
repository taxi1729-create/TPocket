// Provided Firebase Config
const firebaseConfig = {
  databaseURL: "https://tpocket-b3eb6-default-rtdb.firebaseio.com/"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let currentView = 'home', currentShioriId = null, currentDayIdx = 0;
let localShioris = [];

// Realtime Firebase Synchronization
db.ref('shioris').on('value', (snapshot) => {
  const data = snapshot.val();
  if (data) {
    localShioris = Object.keys(data).map(key => ({ id: key, ...data[key] }));
  } else {
    // Default Initial Data
    const initialData = {
      'guam-2026': {
        title: 'グアム3泊4日 🌴 Beach & BBQ', destination: 'グアム', dates: '2026.09.10 - 09.13',
        headerImg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
        days: [
          {
            dayNum: 1, title: 'Day 1: 到着 & ビーチBBQ',
            spots: [
              { id: 's1', time: '10:00', title: 'グアム国際空港 到着', memo: '入国審査書類の書き方に注意！', isAfter: false, beforeImg: 'https://images.unsplash.com/photo-1542296332-2e4473faf563?auto=format&fit=crop&w=600&q=80', afterImg: '', reserveLink: 'https://www.guamairport.com/' },
              { id: 's2', time: '12:30', title: 'ランチ: グアムリーフホテル Reef BBQ', memo: 'オーシャンビュー席で乾杯🍺', isAfter: true, beforeImg: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80', afterImg: 'https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&q=80', reserveLink: 'https://guamreef.com' }
            ]
          },
          { dayNum: 2, title: 'Day 2', spots: [] }
        ]
      }
    };
    db.ref('shioris').set(initialData);
  }
  renderApp();
}, (error) => {
  console.error("Firebase Error:", error);
  document.getElementById('app').innerHTML = `
    <div class="p-6 text-center text-slate-700">
      <h3 class="font-bold text-red-600 mb-2">通信エラーが発生しました</h3>
      <p class="text-xs text-slate-500 mb-4">Firebaseのアクセス権限（ルール）が許可されていない可能性があります。</p>
      <div class="bg-slate-100 p-3 rounded text-left text-[11px] font-mono text-slate-600">
        Firebase Console > Realtime Database > ルール を開き<br>
        ".read": true, ".write": true<br>
        に変更して「公開」を押してください。
      </div>
    </div>
  `;
});

function saveToCloud(shioriId, shioriData) {
  db.ref('shioris/' + shioriId).set(shioriData);
}

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
  return `
    <div class="p-5">
      <div class="flex items-center justify-between mb-6">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg"><i class="fa-solid fa-plane-departure text-xl"></i></div>
          <div><h1 class="text-2xl font-black text-slate-900">TPocket</h1><p class="text-xs text-slate-500 font-medium">みんなで育てる直感旅しおり</p></div>
        </div>
        <span class="text-xs bg-emerald-50 text-emerald-600 px-2.5 py-1 rounded-full font-bold border border-emerald-200">🟢 共有同期中</span>
      </div>

      <button onclick="createNewShiori()" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-4 px-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 mb-8">
        <i class="fa-solid fa-plus"></i><span>新しい旅のしおりをつくる</span>
      </button>

      <div class="mb-4 flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2"><i class="fa-solid fa-folder-closed text-blue-500"></i> マイポケット</h2>
        <span class="text-xs text-slate-400">${localShioris.length}件のしおり</span>
      </div>

      <div class="space-y-4">
        ${localShioris.map(s => `
          <div onclick="navigateTo('detail', '${s.id}')" class="bg-white border rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-all">
            <div class="h-32 bg-slate-100 relative">
              <img src="${s.headerImg}" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
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
  const title = prompt('旅行のタイトルを入力してください:', '新しい旅行計画 ✈️');
  if (!title) return;
  const destination = prompt('目的地を入力してください:', 'グアム') || '未定';
  const dates = prompt('日程を入力してください:', '2026.09.10 - 09.13') || '日程未定';

  const newId = 'shiori-' + Date.now();
  const newData = {
    title: title, destination: destination, dates: dates,
    headerImg: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80',
    days: [
      { dayNum: 1, title: 'Day 1', spots: [] },
      { dayNum: 2, title: 'Day 2', spots: [] }
    ]
  };
  saveToCloud(newId, newData);
  navigateTo('detail', newId);
}

function renderDetailScreen() {
  const shiori = localShioris.find(s => s.id === currentShioriId);
  if (!shiori) return '<div class="p-8 text-center text-xs text-slate-400">読み込み中...</div>';
  const currentDay = (shiori.days && shiori.days[currentDayIdx]) ? shiori.days[currentDayIdx] : { spots: [] };

  return `
    <div class="relative bg-slate-50 min-h-screen">
      <div class="sticky top-0 z-30 bg-slate-900 text-white p-3 px-4 flex items-center justify-between shadow-md">
        <button onclick="navigateTo('home')" class="text-white text-xs font-bold flex items-center gap-1"><i class="fa-solid fa-arrow-left"></i> 戻る</button>
        <span class="text-xs font-bold text-blue-400">TPocket</span>
        <button onclick="deleteShiori('${shiori.id}')" class="text-red-400 text-xs font-bold"><i class="fa-solid fa-trash mr-1"></i>削除</button>
      </div>

      <div class="relative h-48 bg-slate-800">
        <img src="${shiori.headerImg}" class="w-full h-full object-cover">
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent"></div>
        <div class="absolute bottom-4 left-4 right-4 text-white">
          <span class="text-[10px] bg-blue-500 px-2 py-0.5 rounded-full font-bold">${shiori.destination}</span>
          <h2 class="text-xl font-bold mt-1">${shiori.title}</h2>
          <p class="text-xs text-slate-300 mt-0.5">${shiori.dates}</p>
        </div>
      </div>

      <div class="px-4 py-3 flex gap-2 overflow-x-auto hide-scrollbar">
        ${(shiori.days || []).map((d, idx) => `
          <button onclick="currentDayIdx = ${idx}; renderApp();" class="px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap ${currentDayIdx === idx ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border'}">
            Day ${d.dayNum}
          </button>
        `).join('')}
        <button onclick="addDay('${shiori.id}')" class="px-3 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 whitespace-nowrap">+ 日程追加</button>
      </div>

      <div class="p-4 space-y-4 pb-28">
        ${(!currentDay.spots || currentDay.spots.length === 0) ? `
          <div class="text-center py-12 bg-white rounded-2xl border border-dashed p-6 text-xs text-slate-400">
            この日の予定はまだありません。<br>下の「＋ スポット追加」からプランを作成してください。
          </div>
        ` : currentDay.spots.map((spot, sIdx) => `
          <div class="bg-white rounded-2xl p-4 border shadow-sm space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold bg-slate-100 px-2.5 py-1 rounded-lg"><i class="fa-regular fa-clock text-blue-500 mr-1"></i>${spot.time}</span>
              <div class="flex items-center gap-2">
                <button onclick="toggleBeforeAfter('${shiori.id}', ${currentDayIdx}, ${sIdx})" class="text-[10px] font-bold px-2 py-1 rounded-full border ${spot.isAfter ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}">
                  ${spot.isAfter ? '思い出写真' : '参考イメージ'}
                </button>
                <button onclick="deleteSpot('${shiori.id}', ${currentDayIdx}, ${sIdx})" class="text-slate-400 hover:text-red-500 text-xs px-1"><i class="fa-solid fa-xmark"></i></button>
              </div>
            </div>

            <h3 class="font-bold text-slate-800 text-sm">${spot.title}</h3>

            <div class="relative h-40 rounded-xl overflow-hidden bg-slate-100">
              <img src="${spot.isAfter ? (spot.afterImg || spot.beforeImg) : spot.beforeImg}" class="w-full h-full object-cover">
            </div>

            ${spot.memo ? `<p class="text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg">${spot.memo}</p>` : ''}

            <div class="flex gap-2 pt-1">
              ${spot.reserveLink ? `
                <a href="${spot.reserveLink}" target="_blank" class="text-xs font-bold text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
                  <i class="fa-solid fa-link"></i> 保存したWebリンクを開く <i class="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                </a>
              ` : `
                <button onclick="addWebLink('${shiori.id}', ${currentDayIdx}, ${sIdx})" class="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg border border-dashed">
                  + Webリンクを紐付ける
                </button>
              `}
            </div>
          </div>
        `).join('')}
      </div>

      <div class="fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-md px-4 z-20">
        <button onclick="openAddSpotModal('${shiori.id}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-2xl shadow-xl flex items-center justify-center gap-2">
          <i class="fa-solid fa-plus"></i><span>新しいスポット（予定）を追加</span>
        </button>
      </div>
    </div>
  `;
}

function addDay(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    if (!shiori.days) shiori.days = [];
    const nextDayNum = shiori.days.length + 1;
    shiori.days.push({ dayNum: nextDayNum, title: `Day ${nextDayNum}`, spots: [] });
    saveToCloud(shioriId, { title: shiori.title, destination: shiori.destination, dates: shiori.dates, headerImg: shiori.headerImg, days: shiori.days });
  }
}

function openAddSpotModal(shioriId) {
  const title = prompt('スポット名・予定を入力してください:');
  if (!title) return;
  const time = prompt('時間を入力してください (例: 14:00):', '12:00') || '12:00';
  const memo = prompt('メモや注意点を入力してください (任意):', '');
  const reserveLink = prompt('連携するWebリンクURL（予約サイトやGoogle Map等）を入力してください (任意):', '');

  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    if (!shiori.days[currentDayIdx].spots) shiori.days[currentDayIdx].spots = [];
    shiori.days[currentDayIdx].spots.push({
      id: 'spot-' + Date.now(), time: time, title: title, memo: memo, isAfter: false,
      beforeImg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
      afterImg: '', reserveLink: reserveLink
    });
    saveToCloud(shioriId, { title: shiori.title, destination: shiori.destination, dates: shiori.dates, headerImg: shiori.headerImg, days: shiori.days });
  }
}

function addWebLink(shioriId, dayIdx, spotIdx) {
  const url = prompt('保存・紐付けるWebリンクURLを入力してください:');
  if (url) {
    const shiori = localShioris.find(s => s.id === shioriId);
    if (shiori) {
      shiori.days[dayIdx].spots[spotIdx].reserveLink = url;
      saveToCloud(shioriId, { title: shiori.title, destination: shiori.destination, dates: shiori.dates, headerImg: shiori.headerImg, days: shiori.days });
    }
  }
}

function toggleBeforeAfter(shioriId, dayIdx, spotIdx) {
  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    const spot = shiori.days[dayIdx].spots[spotIdx];
    spot.isAfter = !spot.isAfter;
    saveToCloud(shioriId, { title: shiori.title, destination: shiori.destination, dates: shiori.dates, headerImg: shiori.headerImg, days: shiori.days });
  }
}

function deleteSpot(shioriId, dayIdx, spotIdx) {
  if (confirm('この予定を削除しますか？')) {
    const shiori = localShioris.find(s => s.id === shioriId);
    if (shiori) {
      shiori.days[dayIdx].spots.splice(spotIdx, 1);
      saveToCloud(shioriId, { title: shiori.title, destination: shiori.destination, dates: shiori.dates, headerImg: shiori.headerImg, days: shiori.days });
    }
  }
}

function deleteShiori(shioriId) {
  if (confirm('この旅のしおりを完全に削除しますか？')) {
    db.ref('shioris/' + shioriId).remove();
    navigateTo('home');
  }
}