const firebaseConfig = {
  databaseURL: "https://tpocket-b3eb6-default-rtdb.firebaseio.com/"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

// アプリ状態管理
let currentView = 'home'; // 'home' | 'detail' | 'groupAuth'
let currentGroupId = localStorage.getItem('tpocket_group_id') || 'default-group';
let currentShioriId = null;
let currentDayIdx = 0;
let localGroups = {};
let localShioris = [];
let showAllScheduleModal = false;
let editingSpotIdx = null;

// ドラムロール＆インライン用選択アイコン管理
let selectedIcon = '✈️';

// 初期選択用アイコン（10種）
const defaultIcons = ['✈️', '🏨', '🍽️', '☕', '🚗', '📸', '🛍️', '🏖️', '温泉', '🎟️'];

let touchStartX = 0;
let touchEndX = 0;

// クラウドデータ同期
db.ref('appData').on('value', (snapshot) => {
  const data = snapshot.val();
  if (data) {
    localGroups = data.groups || {};
    localShioris = data.shioris ? Object.keys(data.shioris).map(k => ({ id: k, ...data.shioris[k] })) : [];
  } else {
    // 初期構造定義
    const initialData = {
      groups: {
        'default-group': { name: 'メイン旅行グループ', pass: '1234' },
        'friend-trip': { name: '女子旅グループ', pass: '0000' }
      },
      shioris: {
        'guam-2026': {
          groupId: 'default-group',
          title: 'グアム3泊4日 🌴 Beach & BBQ',
          destination: 'グアム',
          startDate: '2026-09-10',
          headerImg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
          days: [
            {
              dayNum: 1, title: 'Day 1',
              spots: [
                { id: 's1', time: '10:00', icon: '✈️', title: 'グアム国際空港 到着', memo: '入国審査書類を確認！', reserveLink: 'https://www.guamairport.com/', imgUrl: '' },
                { id: 's2', time: '12:30', icon: '🍽️', title: 'グアムリーフホテル Reef BBQ', memo: 'オーシャンビュー席でランチ', reserveLink: 'https://guamreef.com', imgUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=600&q=80' }
              ]
            },
            { dayNum: 2, title: 'Day 2', spots: [] },
            { dayNum: 3, title: 'Day 3', spots: [] }
          ]
        }
      }
    };
    db.ref('appData').set(initialData);
  }
  renderApp();
});

function saveAllToCloud() {
  const shiorisObj = {};
  localShioris.forEach(s => {
    const { id, ...rest } = s;
    shiorisObj[id] = rest;
  });
  db.ref('appData').set({
    groups: localGroups,
    shioris: shiorisObj
  });
}

function navigateTo(view, id = null) {
  currentView = view;
  if (id) currentShioriId = id;
  currentDayIdx = 0;
  showAllScheduleModal = false;
  editingSpotIdx = null;
  renderApp();
  window.scrollTo(0, 0);
}

function renderApp() {
  const container = document.getElementById('app');
  if (currentView === 'home') {
    container.innerHTML = renderHomeScreen();
  } else if (currentView === 'detail') {
    container.innerHTML = renderDetailScreen();
    setupSwipeEvents();
  } else if (currentView === 'groupAuth') {
    container.innerHTML = renderGroupAuthScreen();
  }
}

// 1. ホーム画面 (旅行一覧表示 + 設定ボタン)
function renderHomeScreen() {
  const currentGroup = localGroups[currentGroupId] || { name: '未選択グループ' };
  const groupShioris = localShioris.filter(s => s.groupId === currentGroupId);

  return `
    <div class="p-5">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg">
            <i class="fa-solid fa-plane-departure text-xl"></i>
          </div>
          <div>
            <h1 class="text-2xl font-black text-slate-900">TPocket</h1>
            <p class="text-xs text-slate-500 font-medium">${currentGroup.name}</p>
          </div>
        </div>
        
        <!-- 設定・グループ切り替えボタン -->
        <button onclick="navigateTo('groupAuth')" class="text-xs bg-slate-800 text-white px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-md hover:bg-slate-700">
          <i class="fa-solid fa-gear"></i> 設定 / グループ切替
        </button>
      </div>

      <button onclick="createNewShiori()" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 mb-6 hover:opacity-95 transition-all">
        <i class="fa-solid fa-plus"></i><span>このグループに新しい旅行をつくる</span>
      </button>

      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-bold text-slate-800 flex items-center gap-2">
          <i class="fa-solid fa-folder-closed text-blue-500"></i> 旅行一覧 (${currentGroup.name})
        </h2>
        <span class="text-xs text-slate-400 font-bold">${groupShioris.length}件</span>
      </div>

      <div class="space-y-4">
        ${groupShioris.length === 0 ? `
          <div class="text-center py-10 bg-slate-50 rounded-2xl border border-dashed text-xs text-slate-400">このグループには旅行予定がありません</div>
        ` : groupShioris.map(s => `
          <div onclick="navigateTo('detail', '${s.id}')" class="bg-white border rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-all">
            <div class="h-32 bg-slate-100 relative">
              <img src="${s.headerImg || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'}" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
              <div class="absolute bottom-3 left-3 text-white">
                <span class="text-[10px] bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full font-medium">${s.destination || '目的地未定'}</span>
                <h3 class="font-bold text-base mt-1">${s.title}</h3>
              </div>
            </div>
            <div class="p-3.5 flex items-center justify-between text-xs text-slate-500 bg-slate-50">
              <span class="font-medium"><i class="fa-regular fa-calendar mr-1"></i>開始日: ${s.startDate || '未定'}</span>
              <span class="text-blue-600 font-bold">詳細・編集 →</span>
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

// 2. 旅行グループ認証・切替画面
function renderGroupAuthScreen() {
  return `
    <div class="p-5 space-y-6">
      <div class="flex items-center justify-between border-b pb-3">
        <button onclick="navigateTo('home')" class="text-xs font-bold text-blue-600"><i class="fa-solid fa-arrow-left"></i> 戻る</button>
        <h2 class="font-bold text-base text-slate-800">旅行グループ切替 / 認証</h2>
        <div></div>
      </div>

      <div class="bg-blue-50 border border-blue-200 rounded-2xl p-4 text-xs space-y-2">
        <div class="font-bold text-blue-900"><i class="fa-solid fa-users mr-1"></i> 現在選択中: ${localGroups[currentGroupId] ? localGroups[currentGroupId].name : ''}</div>
        <p class="text-slate-600">グループを切り替えるには暗証番号（パスワード）を入力してください。</p>
      </div>

      <div class="space-y-3">
        <h3 class="text-xs font-black text-slate-400 uppercase tracking-wider">登録済みグループ一覧</h3>
        ${Object.keys(localGroups).map(gId => {
          const g = localGroups[gId];
          const isCurrent = gId === currentGroupId;
          return `
            <div class="bg-white border rounded-2xl p-4 flex flex-col gap-2 ${isCurrent ? 'border-blue-500 ring-2 ring-blue-100' : ''}">
              <div class="flex items-center justify-between">
                <span class="font-bold text-sm text-slate-800">${g.name} ${isCurrent ? '<span class="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-2">選択中</span>' : ''}</span>
              </div>
              ${!isCurrent ? `
                <div class="flex items-center gap-2 mt-1">
                  <input type="password" id="pass-${gId}" placeholder="パスワードを入力" class="border text-xs rounded-lg p-2 flex-1 outline-none">
                  <button onclick="authAndSwitchGroup('${gId}')" class="bg-blue-600 text-white font-bold text-xs px-3 py-2 rounded-lg">切替</button>
                </div>
              ` : ''}
            </div>
          `;
        }).join('')}
      </div>

      <!-- 新規グループ作成 -->
      <div class="bg-slate-50 border rounded-2xl p-4 space-y-3">
        <h3 class="text-xs font-bold text-slate-800"><i class="fa-solid fa-plus-circle text-blue-600"></i> 新しいグループを作成</h3>
        <input type="text" id="new-group-name" placeholder="グループ名（例: 家族旅行グループ）" class="w-full border text-xs rounded-lg p-2.5 outline-none bg-white">
        <input type="password" id="new-group-pass" placeholder="パスワード（任意設定）" class="w-full border text-xs rounded-lg p-2.5 outline-none bg-white">
        <button onclick="createNewGroup()" class="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs">グループを新規保存</button>
      </div>
    </div>
  `;
}

// 3. 具体的な旅行詳細・編集画面
function renderDetailScreen() {
  const shiori = localShioris.find(s => s.id === currentShioriId) || localShioris[0];
  if (!shiori) return '<div class="p-8 text-center text-xs text-slate-400">読み込み中...</div>';

  if (!shiori.days || shiori.days.length === 0) {
    shiori.days = [{ dayNum: 1, title: 'Day 1', spots: [] }];
  }
  if (currentDayIdx >= shiori.days.length) currentDayIdx = shiori.days.length - 1;

  const currentDay = shiori.days[currentDayIdx];

  return `
    <div class="relative bg-slate-50 min-h-screen flex flex-col" id="swipe-zone">
      
      <!-- トップヘッダー -->
      <div class="sticky top-0 z-30 bg-slate-900 text-white p-3 px-4 flex items-center justify-between shadow-md">
        <button onclick="navigateTo('home')" class="text-white text-xs font-bold flex items-center gap-1.5 hover:text-blue-300">
          <i class="fa-solid fa-arrow-left"></i> 旅行一覧
        </button>
        <span class="text-xs font-black tracking-wide text-slate-200 truncate max-w-[150px]">${shiori.title}</span>
        <button onclick="showAllScheduleModal = true; renderApp();" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 shadow">
          <i class="fa-solid fa-table-list"></i> 全一覧表示
        </button>
      </div>

      <!-- カレンダー & Day追加バー -->
      <div class="bg-white p-3 border-b shadow-sm space-y-2">
        <div class="flex items-center justify-between text-xs font-bold text-slate-600">
          <label class="flex items-center gap-1.5 cursor-pointer">
            <i class="fa-regular fa-calendar-days text-blue-600 text-sm"></i>
            <span>旅行開始日:</span>
            <input type="date" value="${shiori.startDate || '2026-09-10'}" onchange="updateStartDate('${shiori.id}', this.value)" class="bg-slate-100 border rounded px-2 py-0.5 text-xs font-bold text-slate-800">
          </label>
          <button onclick="addDay('${shiori.id}')" class="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-3 py-1 rounded-lg font-bold border border-blue-200">+ Day追加</button>
        </div>

        <!-- Day タブ -->
        <div class="flex gap-2 overflow-x-auto hide-scrollbar pt-1">
          ${shiori.days.map((d, idx) => `
            <button onclick="switchDay(${idx})" class="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${currentDayIdx === idx ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-100 text-slate-600 border border-slate-200'}">
              Day ${d.dayNum || (idx + 1)} <span class="text-[10px] opacity-80">(${formatShortDate(shiori.startDate, idx)})</span>
            </button>
          `).join('')}
        </div>
      </div>

      <!-- スケジュールタイムライン -->
      <div class="p-4 flex-1 space-y-4 pb-32">
        <div class="flex items-center justify-between">
          <span class="text-xs font-black text-slate-500 uppercase tracking-wider">Day ${currentDay.dayNum || (currentDayIdx + 1)} スケジュール</span>
          <span class="text-[10px] text-slate-400">👈 左右フリックでDay切替 👉</span>
        </div>

        ${(!currentDay.spots || currentDay.spots.length === 0) ? `
          <div class="text-center py-10 bg-white rounded-2xl border border-dashed p-6 text-xs text-slate-400">
            Day ${currentDay.dayNum || (currentDayIdx + 1)} には予定がありません。<br>下のフォームから追加してください。
          </div>
        ` : currentDay.spots.map((spot, sIdx) => `
          <div class="bg-white rounded-2xl p-3.5 border shadow-sm space-y-2 relative">
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-1.5">
                <span class="text-base">${spot.icon || '✈️'}</span>
                <span class="text-xs font-bold bg-blue-50 text-blue-600 px-2.5 py-0.5 rounded-lg"><i class="fa-regular fa-clock mr-1"></i>${spot.time}</span>
              </div>
              <div class="flex items-center gap-2">
                <button onclick="openEditSpot('${shiori.id}', ${sIdx})" class="text-blue-600 text-xs font-bold bg-blue-50 px-2 py-1 rounded-md"><i class="fa-solid fa-pen"></i> 編集</button>
                <button onclick="deleteSpot('${shiori.id}', ${currentDayIdx}, ${sIdx})" class="text-slate-300 hover:text-red-500 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>

            <h3 class="font-bold text-slate-800 text-sm">${spot.title}</h3>
            
            ${spot.memo ? `<p class="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">${spot.memo}</p>` : ''}
            
            <!-- 予定内画像表示 -->
            ${spot.imgUrl ? `
              <div class="rounded-xl overflow-hidden border max-h-48 mt-2">
                <img src="${spot.imgUrl}" class="w-full h-full object-cover">
              </div>
            ` : ''}

            ${spot.reserveLink ? `
              <a href="${spot.reserveLink}" target="_blank" class="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md">
                <i class="fa-solid fa-link"></i> Webリンク <i class="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
              </a>
            ` : ''}
          </div>
        `).join('')}

        <!-- 1画面完結 新規予定追加フォーム -->
        <div class="bg-blue-50/60 border border-blue-200 rounded-2xl p-4 space-y-3 mt-6 shadow-inner">
          <h4 class="text-xs font-bold text-blue-900 flex items-center gap-1.5"><i class="fa-solid fa-plus-circle text-blue-600"></i> Day ${currentDay.dayNum || (currentDayIdx + 1)} に予定を追加</h4>
          
          <!-- 初期アイコン選択（10種） -->
          <div class="space-y-1">
            <label class="text-[10px] font-bold text-slate-500">アイコン選択</label>
            <div class="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1">
              ${defaultIcons.map(icon => `
                <button onclick="selectedIcon = '${icon}'; renderApp();" class="text-lg p-1.5 bg-white border rounded-lg hover:bg-blue-100 ${selectedIcon === icon ? 'border-blue-600 ring-2 ring-blue-200' : ''}">${icon}</button>
              `).join('')}
            </div>
          </div>

          <div class="flex items-center gap-2">
            <!-- 時間ドラムロール -->
            <div class="flex items-center gap-1 bg-white px-2 py-1 border rounded-lg shadow-sm">
              <i class="fa-regular fa-clock text-slate-400 text-xs"></i>
              <select id="input-hour" class="time-picker-select">
                ${Array.from({length:24}).map((_,h) => `<option value="${String(h).padStart(2,'0')}">${String(h).padStart(2,'0')}</option>`).join('')}
              </select>
              <span class="font-bold text-slate-400">:</span>
              <select id="input-minute" class="time-picker-select">
                ${['00','15','30','45'].map(m => `<option value="${m}">${m}</option>`).join('')}
              </select>
            </div>
            <input type="text" id="input-title" placeholder="予定・スポット名" class="flex-1 border text-xs rounded-lg p-2.5 font-medium outline-none focus:border-blue-500 bg-white">
          </div>

          <input type="text" id="input-memo" placeholder="メモ（任意）" class="w-full border text-xs rounded-lg p-2 font-medium outline-none bg-white">
          <input type="text" id="input-img" placeholder="画像URL（任意: https://...）" class="w-full border text-xs rounded-lg p-2 font-medium outline-none bg-white">
          <input type="text" id="input-link" placeholder="WebリンクURL（任意）" class="w-full border text-xs rounded-lg p-2 font-medium outline-none bg-white">

          <button onclick="addSpotInline('${shiori.id}')" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition-all">
            この内容で追加する
          </button>
        </div>
      </div>
    </div>

    <!-- 全スケジュール一覧モーダル -->
    ${showAllScheduleModal ? renderAllScheduleModal(shiori) : ''}

    <!-- 予定編集モーダル -->
    ${editingSpotIdx !== null ? renderEditSpotModal(shiori) : ''}
  `;
}

// 4. 予定編集モーダル
function renderEditSpotModal(shiori) {
  const spot = shiori.days[currentDayIdx].spots[editingSpotIdx];
  const [h, m] = spot.time.split(':');

  return `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
        <div class="flex items-center justify-between border-b pb-2">
          <h3 class="font-bold text-sm text-slate-800">予定の編集</h3>
          <button onclick="editingSpotIdx = null; renderApp();" class="text-slate-400 text-lg"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-[10px] font-bold text-slate-500">アイコン</label>
            <div class="flex gap-1 overflow-x-auto hide-scrollbar pt-1">
              ${defaultIcons.map(icon => `
                <button onclick="document.getElementById('edit-icon').value = '${icon}';" class="text-lg p-1 bg-slate-100 rounded hover:bg-blue-100">${icon}</button>
              `).join('')}
            </div>
            <input type="text" id="edit-icon" value="${spot.icon || '✈️'}" class="border text-xs rounded p-1 w-12 text-center mt-1">
          </div>

          <div class="flex gap-2 items-center">
            <input type="text" id="edit-time" value="${spot.time}" placeholder="12:00" class="border text-xs rounded p-2 w-20 text-center font-bold">
            <input type="text" id="edit-title" value="${spot.title}" class="border text-xs rounded p-2 flex-1 font-bold">
          </div>

          <input type="text" id="edit-memo" value="${spot.memo || ''}" placeholder="メモ" class="w-full border text-xs rounded p-2">
          <input type="text" id="edit-img" value="${spot.imgUrl || ''}" placeholder="画像URL" class="w-full border text-xs rounded p-2">
          <input type="text" id="edit-link" value="${spot.reserveLink || ''}" placeholder="Webリンク" class="w-full border text-xs rounded p-2">
        </div>

        <div class="flex gap-2 pt-2">
          <button onclick="editingSpotIdx = null; renderApp();" class="flex-1 bg-slate-100 text-slate-600 font-bold py-2 rounded-xl text-xs">キャンセル</button>
          <button onclick="saveEditSpot('${shiori.id}')" class="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl text-xs">変更を保存</button>
        </div>
      </div>
    </div>
  `;
}

// 5. 全スケジュール横スクロール一覧表示
function renderAllScheduleModal(shiori) {
  return `
    <div class="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col justify-end">
      <div class="bg-white rounded-t-3xl max-h-[90vh] flex flex-col h-full overflow-hidden">
        <div class="p-4 border-b flex items-center justify-between bg-slate-900 text-white">
          <div>
            <h3 class="font-bold text-sm">全スケジュール一覧</h3>
            <p class="text-[10px] text-slate-400">横スクロールで全日程を表示しています</p>
          </div>
          <button onclick="showAllScheduleModal = false; renderApp();" class="text-slate-400 hover:text-white p-2 text-lg"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="p-4 flex gap-4 overflow-x-auto flex-1 items-start bg-slate-100">
          ${(shiori.days || []).map((day, idx) => `
            <div class="min-w-[260px] max-w-[260px] bg-white rounded-2xl p-4 border shadow-md flex-shrink-0 space-y-3 max-h-full overflow-y-auto">
              <div class="flex items-center justify-between border-b pb-2 sticky top-0 bg-white z-10">
                <span class="font-black text-blue-600 text-sm">Day ${day.dayNum || (idx + 1)}</span>
                <span class="text-xs font-bold text-slate-400">${formatShortDate(shiori.startDate, idx)}</span>
              </div>

              <div class="space-y-2.5">
                ${(!day.spots || day.spots.length === 0) ? `
                  <div class="text-center py-8 text-xs text-slate-300">予定なし</div>
                ` : day.spots.map(s => `
                  <div class="bg-slate-50 p-2.5 rounded-xl border text-xs space-y-1">
                    <div class="flex items-center gap-1">
                      <span>${s.icon || '✈️'}</span>
                      <span class="font-bold text-blue-600 text-[10px] bg-blue-50 px-1.5 py-0.5 rounded">${s.time}</span>
                    </div>
                    <div class="font-bold text-slate-800 mt-1">${s.title}</div>
                    ${s.imgUrl ? `<img src="${s.imgUrl}" class="w-full h-20 object-cover rounded-md my-1">` : ''}
                    ${s.memo ? `<div class="text-[10px] text-slate-500">${s.memo}</div>` : ''}
                  </div>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// 処理アクション関数群
function authAndSwitchGroup(gId) {
  const inputPass = document.getElementById('pass-' + gId).value;
  const targetGroup = localGroups[gId];

  if (targetGroup && targetGroup.pass === inputPass) {
    currentGroupId = gId;
    localStorage.setItem('tpocket_group_id', gId);
    alert('グループを「' + targetGroup.name + '」に切り替えました。');
    navigateTo('home');
  } else {
    alert('パスワードが正しくありません。');
  }
}

function createNewGroup() {
  const name = document.getElementById('new-group-name').value;
  const pass = document.getElementById('new-group-pass').value || '1234';

  if (!name) {
    alert('グループ名を入力してください');
    return;
  }

  const newGId = 'group-' + Date.now();
  localGroups[newGId] = { name: name, pass: pass };
  currentGroupId = newGId;
  localStorage.setItem('tpocket_group_id', newGId);
  saveAllToCloud();
  alert('新しいグループを作成し切り替えました。');
  navigateTo('home');
}

function switchDay(idx) {
  currentDayIdx = idx;
  renderApp();
}

function createNewShiori() {
  const title = prompt('旅行のタイトルを入力してください:', 'グアム旅行 ✈️');
  if (!title) return;
  const destination = prompt('目的地を入力してください:', 'グアム') || '未定';

  const newId = 'shiori-' + Date.now();
  localShioris.push({
    id: newId,
    groupId: currentGroupId,
    title: title,
    destination: destination,
    startDate: '2026-09-10',
    headerImg: 'https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=800&q=80',
    days: [
      { dayNum: 1, title: 'Day 1', spots: [] },
      { dayNum: 2, title: 'Day 2', spots: [] }
    ]
  });
  saveAllToCloud();
  navigateTo('detail', newId);
}

function openEditSpot(shioriId, sIdx) {
  editingSpotIdx = sIdx;
  renderApp();
}

function saveEditSpot(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    const spot = shiori.days[currentDayIdx].spots[editingSpotIdx];
    spot.icon = document.getElementById('edit-icon').value || '✈️';
    spot.time = document.getElementById('edit-time').value || '12:00';
    spot.title = document.getElementById('edit-title').value || '無題';
    spot.memo = document.getElementById('edit-memo').value;
    spot.imgUrl = document.getElementById('edit-img').value;
    spot.reserveLink = document.getElementById('edit-link').value;

    shiori.days[currentDayIdx].spots.sort((a,b) => a.time.localeCompare(b.time));
    editingSpotIdx = null;
    saveAllToCloud();
  }
}

function addSpotInline(shioriId) {
  const hour = document.getElementById('input-hour').value;
  const minute = document.getElementById('input-minute').value;
  const title = document.getElementById('input-title').value;
  const memo = document.getElementById('input-memo').value;
  const imgUrl = document.getElementById('input-img').value;
  const link = document.getElementById('input-link').value;

  if (!title) {
    alert('予定名を入力してください');
    return;
  }

  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    if (!shiori.days[currentDayIdx].spots) shiori.days[currentDayIdx].spots = [];
    shiori.days[currentDayIdx].spots.push({
      id: 'spot-' + Date.now(),
      icon: selectedIcon,
      time: `${hour}:${minute}`,
      title: title,
      memo: memo,
      imgUrl: imgUrl,
      reserveLink: link
    });
    shiori.days[currentDayIdx].spots.sort((a,b) => a.time.localeCompare(b.time));
    saveAllToCloud();
  }
}

function deleteSpot(shioriId, dayIdx, spotIdx) {
  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    shiori.days[dayIdx].spots.splice(spotIdx, 1);
    saveAllToCloud();
  }
}

function updateStartDate(shioriId, newDateStr) {
  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    shiori.startDate = newDateStr;
    saveAllToCloud();
  }
}

function addDay(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  if (shiori) {
    if (!shiori.days) shiori.days = [];
    const nextNum = shiori.days.length + 1;
    shiori.days.push({ dayNum: nextNum, title: `Day ${nextNum}`, spots: [] });
    currentDayIdx = shiori.days.length - 1;
    saveAllToCloud();
  }
}

function setupSwipeEvents() {
  setTimeout(() => {
    const zone = document.getElementById('swipe-zone');
    if (!zone) return;
    zone.ontouchstart = (e) => { touchStartX = e.changedTouches[0].screenX; };
    zone.ontouchend = (e) => {
      touchEndX = e.changedTouches[0].screenX;
      const shiori = localShioris.find(s => s.id === currentShioriId);
      if (shiori) handleSwipe(shiori);
    };
  }, 50);
}

function handleSwipe(shiori) {
  const swipeThreshold = 50;
  if (touchEndX < touchStartX - swipeThreshold) {
    if (currentDayIdx < shiori.days.length - 1) {
      currentDayIdx++;
      renderApp();
    }
  }
  if (touchEndX > touchStartX + swipeThreshold) {
    if (currentDayIdx > 0) {
      currentDayIdx--;
      renderApp();
    }
  }
}

function formatShortDate(baseDateStr, offsetDays) {
  if (!baseDateStr) return '';
  const d = new Date(baseDateStr);
  d.setDate(d.getDate() + offsetDays);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}