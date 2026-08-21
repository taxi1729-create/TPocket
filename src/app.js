const firebaseConfig = {
  databaseURL: "https://tpocket-b3eb6-default-rtdb.firebaseio.com/"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.database();

let currentView = 'home';
let currentGroupId = localStorage.getItem('tpocket_group_id') || 'default-group';
let currentShioriId = null;
let currentDayIdx = 0;
let localGroups = {};
let localShioris = [];
let showAllScheduleModal = false;
let editingSpotIdx = null;
let editingGroupId = null;
let editingHeader = false;
let editingDayIdx = null;

// 管理者機能状態
let isAdmin = false;

const defaultIcons = ['✈️', '🏨', '🍽️', '☕', '🚗', '📸', '🛍️', '🏖️', '温泉', '🎟️'];

db.ref('appData').on('value', (snapshot) => {
  const data = snapshot.val();
  if (data) {
    localGroups = data.groups || {};
    Object.keys(localGroups).forEach(gId => {
      if (!localGroups[gId].members) {
        localGroups[gId].members = ['自分', 'メンバーA'];
      }
    });
    localShioris = data.shioris ? Object.keys(data.shioris).map(k => ({ id: k, ...data.shioris[k] })) : [];
  } else {
    const initialData = {
      groups: {
        'default-group': { name: 'メイン旅行グループ', pass: '1234', members: ['自分', 'メンバーA'] },
      },
      shioris: {
        'default-shiori': {
          groupId: 'default-group',
          title: 'グアム3泊4日 🌴 Beach & BBQ',
          destination: 'グアム',
          startDate: '2026-09-10',
          headerImg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
          showPackingList: true,
          packingList: [
            { id: 'p1', text: 'パスポート・Eチケット', checked: false, link: '' },
            { id: 'p2', text: 'グアムリーフホテル予約確認', checked: false, link: 'https://guamreef.com' }
          ],
          days: [
            { dayNum: 1, title: 'Day 1', memo: '', spots: [] },
            { dayNum: 2, title: 'Day 2', memo: '', spots: [] }
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
  editingGroupId = null;
  editingHeader = false;
  editingDayIdx = null;
  renderApp();
  window.scrollTo(0, 0);
}

function getFormattedDayDate(startDateStr, dayIdx) {
  if (!startDateStr) return '';
  const date = new Date(startDateStr);
  if (isNaN(date.getTime())) return '';
  date.setDate(date.getDate() + dayIdx);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function renderApp() {
  const container = document.getElementById('app');
  if (currentView === 'home') {
    container.innerHTML = renderHomeScreen();
  } else if (currentView === 'detail') {
    container.innerHTML = renderDetailScreen();
    setupSnapScrollListener();
  } else if (currentView === 'groupAuth') {
    container.innerHTML = renderGroupAuthScreen();
  }
}

window.selectIcon = function(val, btnEl, targetId, containerId) {
  document.getElementById(targetId).value = val;
  const container = document.getElementById(containerId);
  if(container) {
    container.querySelectorAll('.icon-btn').forEach(b => b.classList.remove('border-blue-600', 'ring-2', 'ring-blue-200'));
  }
  if(btnEl && btnEl.classList) {
    btnEl.classList.add('border-blue-600', 'ring-2', 'ring-blue-200');
  }
};

function handleImageUpload(inputId, callback) {
  const el = document.getElementById(inputId);
  if (!el || !el.files || el.files.length === 0) {
    callback(null);
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => callback(e.target.result);
  reader.readAsDataURL(el.files[0]);
}

// 4. 旅行一覧画面（マイポケット）＆削除ボタンの追加
function renderHomeScreen() {
  const currentGroup = localGroups[currentGroupId] || { name: '未選択', members: [] };
  const groupShioris = localShioris.filter(s => s.groupId === currentGroupId);
  const members = currentGroup.members || [];

  return `
    <div class="p-5">
      <div class="flex items-center justify-between mb-4">
        <div class="flex items-center gap-2">
          <div class="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg"><i class="fa-solid fa-plane-departure text-xl"></i></div>
          <div><h1 class="text-2xl font-black text-slate-900">TPocket</h1><p class="text-xs text-slate-500 font-medium">${currentGroup.name}</p></div>
        </div>
        <button onclick="navigateTo('groupAuth')" class="text-xs bg-slate-800 text-white px-3 py-2 rounded-xl font-bold flex items-center gap-1.5 shadow-md"><i class="fa-solid fa-gear"></i> 設定</button>
      </div>

      <!-- 共有メンバー編集エリア -->
      <div class="bg-white border rounded-2xl p-3.5 mb-5 shadow-sm space-y-2">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-bold text-slate-700 flex items-center gap-1.5"><i class="fa-solid fa-users text-blue-500"></i> グループ共有メンバー</h2>
          <span class="text-[10px] text-slate-400 font-bold">${members.length}人</span>
        </div>
        <div class="flex flex-wrap gap-1.5">
          ${members.map((m, idx) => `
            <span class="bg-slate-100 text-slate-700 text-xs px-2.5 py-1 rounded-lg font-bold flex items-center gap-1">
              ${m}
              <button onclick="deleteGroupMember('${currentGroupId}', ${idx})" class="text-slate-400 hover:text-red-500"><i class="fa-solid fa-xmark text-[10px]"></i></button>
            </span>
          `).join('')}
        </div>
        <div class="flex items-center gap-2 pt-1 border-t mt-2">
          <input type="text" id="new-group-member-name" placeholder="メンバー名を追加" class="flex-1 border text-xs rounded-lg p-1.5 bg-slate-50">
          <button onclick="addGroupMember('${currentGroupId}')" class="bg-blue-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg">追加</button>
        </div>
      </div>

      <button onclick="createNewShiori()" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg flex items-center justify-center gap-3 mb-6"><i class="fa-solid fa-plus"></i><span>旅行をつくる</span></button>
      
      <div class="mb-3 flex items-center justify-between">
        <h2 class="text-base font-bold flex items-center gap-2"><i class="fa-solid fa-folder-closed text-blue-500"></i> 旅行一覧</h2>
        <span class="text-xs text-slate-400 font-bold">${groupShioris.length}件</span>
      </div>
      <div class="space-y-4">
        ${groupShioris.map(s => `
          <div class="bg-white border rounded-2xl overflow-hidden shadow-sm relative group">
            <div onclick="navigateTo('detail', '${s.id}')" class="h-32 bg-slate-100 relative cursor-pointer">
              <img src="${s.headerImg || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'}" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent"></div>
              <div class="absolute bottom-3 left-3 text-white">
                <span class="text-[10px] bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full font-medium">${s.destination || '目的地未定'}</span>
                <h3 class="font-bold text-base mt-1">${s.title}</h3>
              </div>
            </div>
            <!-- 4. 旅行予定削除ボタン -->
            <button onclick="deleteShiori('${s.id}')" class="absolute top-2.5 right-2.5 bg-black/50 hover:bg-red-600 text-white w-8 h-8 rounded-full flex items-center justify-center backdrop-blur-sm transition-all shadow">
              <i class="fa-solid fa-trash text-xs"></i>
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function deleteShiori(shioriId) {
  if (confirm('この旅行しおりを削除しますか？')) {
    localShioris = localShioris.filter(s => s.id !== shioriId);
    saveAllToCloud();
    renderApp();
  }
}

function addGroupMember(gId) {
  const input = document.getElementById('new-group-member-name');
  if (!input || !input.value.trim()) return alert('名前を入力してください');
  if (!localGroups[gId].members) localGroups[gId].members = [];
  localGroups[gId].members.push(input.value.trim());
  saveAllToCloud();
  renderApp();
}

function deleteGroupMember(gId, idx) {
  if (confirm('このメンバーを削除しますか？')) {
    localGroups[gId].members.splice(idx, 1);
    saveAllToCloud();
    renderApp();
  }
}

// 5. 設定画面に「管理者」ボタンの追加とパスワード可視化
function renderGroupAuthScreen() {
  return `
    <div class="p-5 space-y-6">
      <div class="flex items-center justify-between border-b pb-3">
        <button onclick="navigateTo('home')" class="text-xs font-bold text-blue-600"><i class="fa-solid fa-arrow-left"></i> 戻る</button>
        <h2 class="font-bold text-base">グループ管理</h2>
        <!-- 管理者ボタン -->
        <button onclick="toggleAdminAuth()" class="text-xs ${isAdmin ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'} font-bold px-3 py-1.5 rounded-lg flex items-center gap-1">
          <i class="fa-solid ${isAdmin ? 'fa-lock-open' : 'fa-lock'}"></i> ${isAdmin ? '管理者ON' : '管理者'}
        </button>
      </div>

      <div class="space-y-3">
        ${Object.keys(localGroups).map(gId => {
          const g = localGroups[gId];
          const isCurrent = gId === currentGroupId;
          return `
            <div class="bg-white border rounded-2xl p-4 flex flex-col gap-2 ${isCurrent ? 'border-blue-500 ring-2 ring-blue-100' : ''}">
              <div class="flex items-center justify-between">
                <div>
                  <span class="font-bold text-sm">${g.name} ${isCurrent ? '<span class="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-1">選択中</span>' : ''}</span>
                  <!-- 管理者認証済みの場合パスワード可視化 -->
                  ${isAdmin ? `<div class="text-[11px] font-mono text-amber-600 font-bold mt-0.5"><i class="fa-solid fa-key text-[10px]"></i> PW: ${g.pass}</div>` : ''}
                </div>
                <button onclick="authAndEditGroup('${gId}')" class="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded">編集</button>
              </div>
              ${editingGroupId === gId ? `
                <div class="mt-2 p-3 bg-slate-50 border rounded-xl space-y-2">
                  <label class="text-[10px] font-bold text-slate-500">名称変更</label>
                  <input type="text" id="edit-g-name-${gId}" value="${g.name}" class="w-full border text-xs rounded p-2">
                  <label class="text-[10px] font-bold text-slate-500">パスワード変更</label>
                  <input type="${isAdmin ? 'text' : 'password'}" id="edit-g-pass-${gId}" value="${g.pass}" class="w-full border text-xs rounded p-2">
                  <div class="flex gap-2 pt-2">
                    <button onclick="saveEditedGroup('${gId}')" class="flex-1 bg-blue-600 text-white font-bold py-2 rounded-lg text-xs">保存</button>
                    <button onclick="deleteGroup('${gId}')" class="flex-1 bg-red-500 text-white font-bold py-2 rounded-lg text-xs">削除</button>
                    <button onclick="editingGroupId = null; renderApp();" class="flex-1 bg-slate-200 text-slate-700 font-bold py-2 rounded-lg text-xs">取消</button>
                  </div>
                </div>
              ` : `
                ${!isCurrent ? `
                  <div class="flex items-center gap-2 mt-1">
                    <input type="password" id="pass-${gId}" placeholder="パスワードを入力" class="border text-xs rounded-lg p-2 flex-1">
                    <button onclick="authAndSwitchGroup('${gId}')" class="bg-blue-600 text-white font-bold text-xs px-3 py-2 rounded-lg">切替</button>
                  </div>
                ` : ''}
              `}
            </div>
          `;
        }).join('')}
      </div>

      <div class="bg-slate-50 border rounded-2xl p-4 space-y-3">
        <h3 class="text-xs font-bold"><i class="fa-solid fa-plus-circle text-blue-600"></i> 新規作成</h3>
        <input type="text" id="new-group-name" placeholder="グループ名" class="w-full border text-xs rounded-lg p-2.5">
        <input type="password" id="new-group-pass" placeholder="パスワード" class="w-full border text-xs rounded-lg p-2.5">
        <button onclick="createNewGroup()" class="w-full bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs">新規作成</button>
      </div>
    </div>
  `;
}

// 5. 管理者認証トグル (パスワード: 750651)
function toggleAdminAuth() {
  if (isAdmin) {
    isAdmin = false;
    renderApp();
  } else {
    const inputPass = prompt('管理者パスワードを入力してください:');
    if (inputPass === '750651') {
      isAdmin = true;
      renderApp();
    } else if (inputPass !== null) {
      alert('管理者パスワードが正しくありません');
    }
  }
}

function renderDetailScreen() {
  const shiori = localShioris.find(s => s.id === currentShioriId);
  if (!shiori) return '...';

  if (!shiori.packingList) shiori.packingList = [];
  if (shiori.showPackingList === undefined) shiori.showPackingList = true;

  const currentGroup = localGroups[shiori.groupId || currentGroupId] || { members: ['全員'] };
  const groupMembers = currentGroup.members || [];

  return `
    <div class="relative bg-slate-50 min-h-screen flex flex-col">
      <!-- 2. 黒い枠の固定化（sticky top-0 z-50 でスクロールしても上部固定） -->
      <div class="sticky top-0 z-50 bg-slate-900 text-white p-3 px-4 flex justify-between items-center shadow-md">
        <button onclick="navigateTo('home')" class="text-xs font-bold flex items-center gap-1.5 hover:text-blue-400"><i class="fa-solid fa-arrow-left"></i> 旅行一覧</button>
        <span class="text-xs font-black truncate max-w-[160px] text-center">${shiori.title}</span>
        <button onclick="showAllScheduleModal = true; renderApp();" class="text-xs bg-blue-600 px-3 py-1.5 rounded-lg font-bold">全一覧</button>
      </div>

      <!-- ヘッダー画像・タイトル -->
      <div class="relative bg-slate-800 text-white">
        <div class="h-44 w-full relative overflow-hidden">
          <img src="${shiori.headerImg || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
        </div>

        <div class="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <span class="text-[10px] bg-blue-600/80 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full font-bold">${shiori.destination || '目的地未設定'}</span>
            <h1 class="text-lg font-black mt-1 leading-snug drop-shadow">${shiori.title}</h1>
          </div>
          <button onclick="editingHeader = true; renderApp();" class="bg-white/20 backdrop-blur-md text-white border border-white/40 text-xs px-2.5 py-1 rounded-xl font-bold hover:bg-white/30"><i class="fa-solid fa-pen"></i> 編集</button>
        </div>
      </div>

      <!-- ヘッダー編集モーダル -->
      ${editingHeader ? `
        <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl w-full max-w-sm p-5 space-y-3 text-slate-800 shadow-2xl">
            <h3 class="font-bold text-sm border-b pb-2">旅行情報の編集</h3>
            <label class="text-[10px] font-bold text-slate-500">タイトル</label>
            <input type="text" id="header-title-input" value="${shiori.title}" class="w-full border text-xs rounded p-2">
            <label class="text-[10px] font-bold text-slate-500">旅行先・目的地</label>
            <input type="text" id="header-dest-input" value="${shiori.destination || ''}" class="w-full border text-xs rounded p-2">
            <label class="text-[10px] font-bold text-slate-500">ヘッダー画像変更</label>
            <input type="file" id="header-img-file" accept="image/*" class="w-full border text-[10px] p-2 rounded">
            <div class="flex gap-2 pt-2">
              <button onclick="saveHeaderInfo('${shiori.id}')" class="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl text-xs">保存</button>
              <button onclick="editingHeader = false; renderApp();" class="flex-1 bg-slate-200 text-slate-700 font-bold py-2 rounded-xl text-xs">キャンセル</button>
            </div>
          </div>
        </div>
      ` : ''}

      <!-- 持ち物リスト -->
      <div class="bg-white p-4 border-b space-y-3">
        <div class="flex items-center justify-between">
          <button onclick="togglePackingList('${shiori.id}')" class="font-bold text-xs text-slate-800 flex items-center gap-1.5">
            <i class="fa-solid fa-suitcase text-blue-600"></i>
            <span>持ち物リスト (${shiori.packingList.filter(p=>p.checked).length}/${shiori.packingList.length})</span>
            <i class="fa-solid ${shiori.showPackingList ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] text-slate-400"></i>
          </button>
          <span class="text-[10px] text-slate-400">各自追加可能</span>
        </div>

        ${shiori.showPackingList ? `
          <div class="space-y-2 pt-1">
            <div class="space-y-1.5 max-h-40 overflow-y-auto">
              ${shiori.packingList.length === 0 ? '<div class="text-[11px] text-slate-400 italic">持ち物がまだありません</div>' : ''}
              ${shiori.packingList.map((item, pIdx) => `
                <div class="flex items-center justify-between bg-slate-50 p-2 rounded-lg text-xs">
                  <label class="flex items-center gap-2 flex-1 cursor-pointer">
                    <input type="checkbox" ${item.checked ? 'checked' : ''} onchange="togglePackingItem('${shiori.id}', ${pIdx})" class="rounded text-blue-600">
                    <span class="${item.checked ? 'line-through text-slate-400' : 'text-slate-800 font-medium'}">${item.text}</span>
                  </label>
                  ${item.link ? `
                    <a href="${item.link}" target="_blank" class="text-blue-600 text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded flex items-center gap-0.5">
                      <i class="fa-solid fa-link"></i> リンク
                    </a>
                  ` : ''}
                  <button onclick="deletePackingItem('${shiori.id}', ${pIdx})" class="text-slate-300 hover:text-red-500 ml-2"><i class="fa-solid fa-xmark text-xs"></i></button>
                </div>
              `).join('')}
            </div>

            <div class="flex items-center gap-1.5 pt-2 border-t">
              <input type="text" id="new-pack-text" placeholder="持ち物名" class="flex-1 border text-xs rounded-lg p-2 bg-slate-50">
              <input type="text" id="new-pack-link" placeholder="リンクURL(任意)" class="w-28 border text-xs rounded-lg p-2 bg-slate-50">
              <button onclick="addPackingItem('${shiori.id}')" class="bg-blue-600 text-white font-bold text-xs px-3 py-2 rounded-lg">追加</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- カレンダー & Dayタブ -->
      <div class="bg-white p-3 border-b space-y-2">
        <div class="flex justify-between text-xs font-bold text-slate-600">
          <label class="flex items-center gap-1">
            <i class="fa-regular fa-calendar-days text-blue-600"></i> 開始日:
            <input type="date" value="${shiori.startDate || '2026-09-10'}" onchange="updateStartDate('${shiori.id}', this.value)" class="bg-slate-100 border rounded px-1.5 py-0.5 text-xs font-bold">
          </label>
          <button onclick="addDay('${shiori.id}')" class="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold border border-blue-200">+ Day追加</button>
        </div>

        <div class="flex gap-2 overflow-x-auto hide-scrollbar pt-1">
          ${shiori.days.map((d, idx) => {
            const dateStr = getFormattedDayDate(shiori.startDate, idx);
            const displayTitle = d.title || `Day ${d.dayNum || idx + 1}`;
            return `
              <button onclick="scrollToDay(${idx})" class="px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${currentDayIdx === idx ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-600'}">
                ${displayTitle}${dateStr ? ` (${dateStr})` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- スワイプ案内 -->
      <div class="text-center py-2 bg-slate-100 border-b text-[11px] text-slate-500 font-bold flex items-center justify-center gap-2">
        <i class="fa-solid fa-hand-pointer text-blue-500 animate-pulse"></i> 👈 スワイプでDay切替 （端で2秒長押しフリックでDay追加） 👉
      </div>

      <!-- シームレス横フリック (CSS Scroll Snap) -->
      <div id="snap-scroll-container" class="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar w-full py-4 gap-3 px-4">
        ${shiori.days.map((day, dIdx) => {
          const dateStr = getFormattedDayDate(shiori.startDate, dIdx);
          const displayTitle = day.title || `Day ${day.dayNum || dIdx + 1}`;

          return `
            <div class="snap-center shrink-0 w-[88vw] max-w-[370px] bg-slate-100/70 border rounded-3xl p-4 space-y-4 shadow-sm flex flex-col justify-between">
              <div>
                <div class="flex items-center justify-between border-b pb-2 mb-2">
                  <div>
                    <span class="font-black text-slate-800 text-sm">${displayTitle}${dateStr ? ` (${dateStr})` : ''}</span>
                    ${day.memo ? `<p class="text-[11px] text-slate-500 mt-0.5">${day.memo}</p>` : ''}
                  </div>
                  <button onclick="editingDayIdx = ${dIdx}; renderApp();" class="text-xs bg-white text-slate-600 border px-2 py-1 rounded-lg font-bold hover:bg-slate-50">
                    <i class="fa-solid fa-pen"></i> 編集
                  </button>
                </div>

                <div class="space-y-3 pt-1">
                  ${(!day.spots || day.spots.length === 0) ? `
                    <div class="text-center py-8 bg-white rounded-2xl border border-dashed text-xs text-slate-400">予定がありません</div>
                  ` : day.spots.map((spot, sIdx) => {
                    const selectedMembers = spot.members || [];
                    return `
                      <div class="bg-white rounded-2xl p-3 border shadow-sm space-y-2">
                        <div class="flex justify-between items-center">
                          <div class="flex items-center gap-1.5">
                            <span class="text-base">${spot.icon || '✈️'}</span>
                            <span class="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg">${spot.time}</span>
                          </div>
                          <div class="flex gap-1.5">
                            <button onclick="openEditSpot('${shiori.id}', ${dIdx}, ${sIdx})" class="text-blue-600 text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded"><i class="fa-solid fa-pen"></i></button>
                            <button onclick="deleteSpot('${shiori.id}', ${dIdx}, ${sIdx})" class="text-slate-300 hover:text-red-500 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
                          </div>
                        </div>
                        <h3 class="font-bold text-sm text-slate-800">${spot.title}</h3>
                        ${spot.memo ? `<p class="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">${spot.memo}</p>` : ''}
                        
                        ${selectedMembers.length > 0 ? `
                          <div class="flex flex-wrap gap-1 pt-1">
                            ${selectedMembers.map(m => `<span class="text-[9px] bg-indigo-50 text-indigo-600 font-bold px-1.5 py-0.5 rounded"><i class="fa-solid fa-user text-[8px]"></i> ${m}</span>`).join('')}
                          </div>
                        ` : ''}

                        ${spot.link ? `
                          <div class="pt-0.5">
                            <a href="${spot.link}" target="_blank" class="text-blue-600 text-[11px] font-bold inline-flex items-center gap-1 hover:underline">
                              <i class="fa-solid fa-link text-[10px]"></i> 関連リンクを見る
                            </a>
                          </div>
                        ` : ''}

                        ${spot.imgUrl ? `<div class="rounded-xl overflow-hidden border max-h-40 mt-1"><img src="${spot.imgUrl}" class="w-full h-full object-cover"></div>` : ''}
                      </div>
                    `;
                  }).join('')}
                </div>
              </div>

              <!-- 1. 予定追加フォーム & 修正された追加ボタン -->
              <div class="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 space-y-2.5 mt-4">
                <h4 class="text-[11px] font-bold text-blue-900"><i class="fa-solid fa-plus-circle text-blue-600"></i> ${displayTitle} に予定を追加</h4>
                <input type="hidden" id="input-icon-${dIdx}" value="✈️">
                <div class="flex gap-1 overflow-x-auto hide-scrollbar pb-1" id="icon-container-${dIdx}">
                  ${defaultIcons.map((icon, i) => `<button type="button" onclick="window.selectIcon('${icon}', this, 'input-icon-${dIdx}', 'icon-container-${dIdx}')" class="icon-btn text-base p-1 bg-white border rounded hover:bg-blue-100 ${i===0?'border-blue-600 ring-2 ring-blue-200':''}">${icon}</button>`).join('')}
                  <input type="text" placeholder="任意" maxlength="2" oninput="window.selectIcon(this.value, this, 'input-icon-${dIdx}', 'icon-container-${dIdx}')" class="icon-btn w-10 text-xs border rounded text-center font-bold bg-white">
                </div>
                <div class="flex gap-2">
                  <div class="flex items-center gap-0.5 bg-white px-1.5 py-1 border rounded-lg">
                    <select id="input-hour-${dIdx}" class="time-picker-select text-xs">${Array.from({length:24}).map((_,h) => `<option value="${String(h).padStart(2,'0')}">${String(h).padStart(2,'0')}</option>`).join('')}</select>
                    <span class="text-xs font-bold">:</span>
                    <select id="input-minute-${dIdx}" class="time-picker-select text-xs">${['00','15','30','45'].map(m => `<option value="${m}">${m}</option>`).join('')}</select>
                  </div>
                  <input type="text" id="input-title-${dIdx}" placeholder="予定名" class="flex-1 border text-xs rounded-lg p-2 bg-white">
                </div>
                <input type="text" id="input-memo-${dIdx}" placeholder="メモ（任意）" class="w-full border text-xs rounded-lg p-1.5 bg-white">
                
                <div class="w-full bg-white border text-[10px] rounded-lg p-1.5 flex justify-between items-center">
                   <span class="text-slate-500">画像添付</span>
                   <input type="file" id="input-img-file-${dIdx}" accept="image/*" class="text-[9px]">
                </div>

                <input type="url" id="input-link-${dIdx}" placeholder="関連リンクURL (任意)" class="w-full border text-xs rounded-lg p-1.5 bg-white">

                <div class="bg-white border text-xs rounded-lg p-2 space-y-1">
                  <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-slate-500">参加メンバー</span>
                    <button type="button" onclick="selectAllInlineMembers(${dIdx})" class="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-2 py-0.5 rounded">全員</button>
                  </div>
                  <div class="flex flex-wrap gap-2 pt-0.5">
                    ${groupMembers.map((m) => `
                      <label class="flex items-center gap-1 cursor-pointer text-[11px]">
                        <input type="checkbox" name="inline-member-${dIdx}" value="${m}" checked class="rounded text-blue-600">
                        <span>${m}</span>
                      </label>
                    `).join('')}
                  </div>
                </div>

                <!-- 1. 追加ボタン (onclickイベント修正済み) -->
                <button onclick="addSpotInline('${shiori.id}', ${dIdx})" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded-xl text-xs shadow-sm">追加する</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    ${showAllScheduleModal ? renderAllScheduleModal(shiori) : ''}
    ${editingSpotIdx !== null ? renderEditSpotModal(shiori) : ''}
    ${editingDayIdx !== null ? renderEditDayModal(shiori) : ''}
  `;
}

function selectAllInlineMembers(dIdx) {
  const checkboxes = document.querySelectorAll(`input[name="inline-member-${dIdx}"]`);
  checkboxes.forEach(cb => cb.checked = true);
}

function selectAllEditMembers() {
  const checkboxes = document.querySelectorAll(`input[name="edit-spot-member"]`);
  checkboxes.forEach(cb => cb.checked = true);
}

function renderEditDayModal(shiori) {
  const day = shiori.days[editingDayIdx];
  const dateStr = getFormattedDayDate(shiori.startDate, editingDayIdx);

  return `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl text-slate-800">
        <div class="flex justify-between border-b pb-2">
          <h3 class="font-bold text-sm">Day ${day.dayNum || editingDayIdx + 1}${dateStr ? ` (${dateStr})` : ''} の編集</h3>
          <button onclick="editingDayIdx = null; renderApp();" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-[10px] font-bold text-slate-500">Day タイトル</label>
            <input type="text" id="edit-day-title" value="${day.title || `Day ${day.dayNum || editingDayIdx + 1}`}" class="w-full border text-xs rounded p-2">
          </div>
          <div>
            <label class="text-[10px] font-bold text-slate-500">Day メモ</label>
            <textarea id="edit-day-memo" rows="3" placeholder="この日の概要やメモ" class="w-full border text-xs rounded p-2">${day.memo || ''}</textarea>
          </div>
        </div>

        <div class="space-y-2 pt-2 border-t">
          <button onclick="saveDayEdit('${shiori.id}')" class="w-full bg-blue-600 text-white font-bold py-2 rounded-xl text-xs">変更を保存</button>
          <button onclick="deleteDay('${shiori.id}', ${editingDayIdx})" class="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 rounded-xl text-xs"><i class="fa-solid fa-trash"></i> このDayを削除</button>
        </div>
      </div>
    </div>
  `;
}

function saveDayEdit(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  const day = shiori.days[editingDayIdx];
  
  day.title = document.getElementById('edit-day-title').value.trim() || `Day ${day.dayNum || editingDayIdx + 1}`;
  day.memo = document.getElementById('edit-day-memo').value.trim();

  editingDayIdx = null;
  saveAllToCloud();
  renderApp();
}

function deleteDay(shioriId, dIdx) {
  if (confirm('このDayと配下の予定を削除してもよろしいですか？')) {
    const shiori = localShioris.find(s => s.id === shioriId);
    shiori.days.splice(dIdx, 1);
    shiori.days.forEach((d, idx) => {
      d.dayNum = idx + 1;
    });
    editingDayIdx = null;
    currentDayIdx = Math.max(0, dIdx - 1);
    saveAllToCloud();
    renderApp();
  }
}

function renderEditSpotModal(shiori) {
  const spot = shiori.days[currentDayIdx].spots[editingSpotIdx];
  const [hh, mm] = spot.time.split(':');

  const currentGroup = localGroups[shiori.groupId || currentGroupId] || { members: ['全員'] };
  const groupMembers = currentGroup.members || [];
  const selectedMembers = spot.members || groupMembers;

  return `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl text-slate-800">
        <div class="flex justify-between border-b pb-2">
          <h3 class="font-bold text-sm">予定の編集</h3>
          <button onclick="editingSpotIdx = null; renderApp();" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="space-y-3">
          <input type="hidden" id="edit-icon" value="${spot.icon || '✈️'}">
          <div class="space-y-1">
            <label class="text-[10px] font-bold text-slate-500">アイコン選択</label>
            <div class="flex gap-1.5 overflow-x-auto hide-scrollbar pb-1" id="edit-icon-container">
              ${defaultIcons.map((icon) => `<button type="button" onclick="window.selectIcon('${icon}', this, 'edit-icon', 'edit-icon-container')" class="icon-btn text-lg p-1 bg-slate-100 rounded hover:bg-blue-100 ${icon === spot.icon ? 'border-blue-600 ring-2 ring-blue-200' : ''}">${icon}</button>`).join('')}
              <input type="text" placeholder="任意" maxlength="2" value="${defaultIcons.includes(spot.icon) ? '' : spot.icon}" oninput="window.selectIcon(this.value, this, 'edit-icon', 'edit-icon-container')" class="icon-btn w-10 text-xs border rounded text-center font-bold">
            </div>
          </div>

          <div class="flex gap-2 items-center">
          <div class="flex items-center gap-0.5 bg-slate-50 px-2 py-1 border rounded-lg">
           <select id="edit-hour" class="time-picker-select text-xs">
              ${Array.from({length:24}).map((_,h) => { const hs = String(h).padStart(2,'0'); return `<option value="${hs}" ${hs === hh ? 'selected' : ''}>${hs}</option>`; }).join('')}
            </select>
            <span>:</span>
            <select id="edit-minute" class="time-picker-select text-xs">
              ${['00','15','30','45'].map(m => `<option value="${m}" ${m === mm ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
          </div>
          <input type="text" id="edit-title" value="${spot.title}" class="border text-xs rounded p-2 flex-1 font-bold">
        </div>

          <input type="text" id="edit-memo" value="${spot.memo || ''}" placeholder="メモ" class="w-full border text-xs rounded p-2">
          
          <div class="w-full bg-slate-50 border text-xs rounded p-2 space-y-2">
             <div class="flex items-center justify-between">
               <span class="text-slate-500 font-medium text-[10px]">画像差替</span>
               <input type="file" id="edit-img-file" accept="image/*" class="text-[10px]">
             </div>
             ${spot.imgUrl ? `
               <div class="flex items-center gap-2 bg-red-50 p-1 rounded">
                 <input type="checkbox" id="edit-img-delete"> <label for="edit-img-delete" class="text-[10px] text-red-600 font-bold">画像を削除</label>
               </div>
             ` : ''}
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-500">関連リンク</label>
            <input type="url" id="edit-link" value="${spot.link || ''}" placeholder="https://..." class="w-full border text-xs rounded p-2">
          </div>

          <div class="border text-xs rounded p-2 space-y-1 bg-slate-50">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-slate-500">参加メンバー</label>
              <button type="button" onclick="selectAllEditMembers()" class="text-[10px] bg-slate-200 hover:bg-slate-300 font-bold px-2 py-0.5 rounded">全員</button>
            </div>
            <div class="flex flex-wrap gap-2 pt-1">
              ${groupMembers.map((m) => `
                <label class="flex items-center gap-1 cursor-pointer text-[11px]">
                  <input type="checkbox" name="edit-spot-member" value="${m}" ${selectedMembers.includes(m) ? 'checked' : ''} class="rounded text-blue-600">
                  <span>${m}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <button onclick="saveEditSpot('${shiori.id}')" class="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl text-xs">変更を保存</button>
        </div>
      </div>
    </div>
  `;
}

function renderAllScheduleModal(shiori) {
  return `
    <div class="fixed inset-0 z-50 bg-black/80 flex flex-col justify-end">
      <div class="bg-white rounded-t-3xl h-[85vh] p-4 flex flex-col">
        <div class="flex justify-between items-center border-b pb-2 mb-3">
          <h3 class="font-bold text-sm">全日程スケジュール</h3>
          <button onclick="showAllScheduleModal=false;renderApp();" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="flex gap-3 overflow-x-auto flex-1 items-start bg-slate-100 p-3 rounded-2xl">
          ${shiori.days.map((day, idx) => {
            const dateStr = getFormattedDayDate(shiori.startDate, idx);
            const displayTitle = day.title || `Day ${day.dayNum || idx + 1}`;
            return `
              <div class="min-w-[240px] max-w-[240px] bg-white rounded-xl p-3 border shadow-sm space-y-2 max-h-full overflow-y-auto">
                <span class="font-bold text-xs text-blue-600">${displayTitle}${dateStr ? ` (${dateStr})` : ''}</span>
                <div class="space-y-2">
                  ${day.spots.map(s => `
                    <div class="bg-slate-50 p-2 rounded text-xs">
                      <span class="font-bold text-blue-600 text-[10px]">${s.time}</span> ${s.icon}
                      <div class="font-bold">${s.title}</div>
                    </div>
                  `).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}

// --- 修正箇所（構文エラーの解消） ---
function authAndSwitchGroup(gId) {
  const inputEl = document.getElementById('pass-' + gId);
  if (!inputEl) return;
  const inputPass = inputEl.value;
  if (localGroups[gId] && localGroups[gId].pass === inputPass) {
    currentGroupId = gId;
    localStorage.setItem('tpocket_group_id', gId);
    navigateTo('home');
  } else {
    alert('パスワードが正しくありません');
  }
}

function authAndEditGroup(gId) {
  const pass = prompt('編集用パスワードを入力してください:');
  if (pass === null) return;
  if (localGroups[gId] && localGroups[gId].pass === pass) {
    editingGroupId = gId;
    renderApp();
  } else {
    alert('パスワードが違います');
  }
}

function saveEditedGroup(gId) {
  const nameEl = document.getElementById('edit-g-name-' + gId);
  const passEl = document.getElementById('edit-g-pass-' + gId);
  if (!nameEl || !passEl) return;
  const newName = nameEl.value;
  const newPass = passEl.value;
  if (!newName || !newPass) return alert('入力不足です');
  localGroups[gId].name = newName;
  localGroups[gId].pass = newPass;
  editingGroupId = null;
  saveAllToCloud();
  renderApp();
}

function deleteGroup(gId) {
  if (confirm('グループを削除しますか？')) {
    delete localGroups[gId];
    if (currentGroupId === gId) {
      currentGroupId = Object.keys(localGroups)[0] || null;
    }
    editingGroupId = null;
    saveAllToCloud();
    renderApp();
  }
}

function createNewGroup() {
  const nameEl = document.getElementById('new-group-name');
  const passEl = document.getElementById('new-group-pass');
  if (!nameEl) return;
  const name = nameEl.value;
  const pass = (passEl && passEl.value) ? passEl.value : '1234';
  if (!name) return alert('入力してください');
  const newGId = 'group-' + Date.now();
  localGroups[newGId] = { name, pass, members: ['自分'] };
  currentGroupId = newGId;
  localStorage.setItem('tpocket_group_id', newGId);
  saveAllToCloud();
  navigateTo('home');
}

function createNewShiori() {
  const newId = 'shiori-' + Date.now();
  localShioris.push({
    id: newId,
    groupId: currentGroupId,
    title: '新規旅行計画 🌴',
    destination: '未定',
    startDate: '2026-09-10',
    headerImg: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    showPackingList: true,
    packingList: [],
    days: [{ dayNum: 1, title: 'Day 1', memo: '', spots: [] }]
  });
  saveAllToCloud(); navigateTo('detail', newId);
}

function openEditSpot(sId, dIdx, sIdx) { currentDayIdx = dIdx; editingSpotIdx = sIdx; renderApp(); }

function saveEditSpot(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  const spot = shiori.days[currentDayIdx].spots[editingSpotIdx];
  
  spot.icon = document.getElementById('edit-icon').value || '✈️';
  spot.time = document.getElementById('edit-hour').value + ':' + document.getElementById('edit-minute').value;
  spot.title = document.getElementById('edit-title').value || '無題';
  spot.memo = document.getElementById('edit-memo').value;
  spot.link = document.getElementById('edit-link').value;

  const memberCheckboxes = document.querySelectorAll('input[name="edit-spot-member"]:checked');
  spot.members = Array.from(memberCheckboxes).map(cb => cb.value);

  handleImageUpload('edit-img-file', (base64Img) => {
    if (document.getElementById('edit-img-delete') && document.getElementById('edit-img-delete').checked) {
      spot.imgUrl = '';
    } else if (base64Img) {
      spot.imgUrl = base64Img;
    }
    shiori.days[currentDayIdx].spots.sort((a,b) => a.time.localeCompare(b.time));
    editingSpotIdx = null; saveAllToCloud(); renderApp();
  });
}

// 1. 予定追加関数の修正 (エレメント値読み取りの不具合解消)
function addSpotInline(shioriId, dIdx) {
  const titleEl = document.getElementById('input-title-' + dIdx);
  if (!titleEl || !titleEl.value.trim()) return alert('予定名を入力してください');
  
  const shiori = localShioris.find(s => s.id === shioriId);
  if (!shiori) return;

  const title = titleEl.value.trim();
  const hourEl = document.getElementById('input-hour-' + dIdx);
  const minEl = document.getElementById('input-minute-' + dIdx);
  const memoEl = document.getElementById('input-memo-' + dIdx);
  const iconEl = document.getElementById('input-icon-' + dIdx);
  const linkEl = document.getElementById('input-link-' + dIdx);

  const time = (hourEl ? hourEl.value : '00') + ':' + (minEl ? minEl.value : '00');
  const memo = memoEl ? memoEl.value : '';
  const icon = iconEl ? iconEl.value : '✈️';
  const link = linkEl ? linkEl.value : '';

  const memberCheckboxes = document.querySelectorAll(`input[name="inline-member-${dIdx}"]:checked`);
  const members = Array.from(memberCheckboxes).map(cb => cb.value);

  handleImageUpload('input-img-file-' + dIdx, (base64Img) => {
    if (!shiori.days[dIdx].spots) shiori.days[dIdx].spots = [];
    shiori.days[dIdx].spots.push({
      id: 'spot-' + Date.now(),
      icon,
      time,
      title,
      memo,
      link,
      members,
      imgUrl: base64Img || ''
    });
    shiori.days[dIdx].spots.sort((a,b) => a.time.localeCompare(b.time));
    saveAllToCloud(); 
    renderApp();
  });
}

function deleteSpot(shioriId, dayIdx, spotIdx) {
  localShioris.find(s => s.id === shioriId).days[dayIdx].spots.splice(spotIdx, 1); saveAllToCloud(); renderApp();
}

function updateStartDate(shioriId, val) {
  localShioris.find(s => s.id === shioriId).startDate = val; saveAllToCloud(); renderApp();
}

function addDay(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  const newDayNum = shiori.days.length + 1;
  shiori.days.push({ dayNum: newDayNum, title: `Day ${newDayNum}`, memo: '', spots: [] });
  saveAllToCloud(); renderApp();
}

function saveHeaderInfo(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  const title = document.getElementById('header-title-input').value;
  const dest = document.getElementById('header-dest-input').value;

  if (title) shiori.title = title;
  shiori.destination = dest;

  handleImageUpload('header-img-file', (base64Img) => {
    if (base64Img) shiori.headerImg = base64Img;
    editingHeader = false;
    saveAllToCloud();
    renderApp();
  });
}

function togglePackingList(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  shiori.showPackingList = !shiori.showPackingList;
  saveAllToCloud();
  renderApp();
}

function togglePackingItem(shioriId, idx) {
  const shiori = localShioris.find(s => s.id === shioriId);
  shiori.packingList[idx].checked = !shiori.packingList[idx].checked;
  saveAllToCloud();
  renderApp();
}

function addPackingItem(shioriId) {
  const text = document.getElementById('new-pack-text').value;
  const link = document.getElementById('new-pack-link').value;
  if (!text) return alert('持ち物名を入力してください');

  const shiori = localShioris.find(s => s.id === shioriId);
  shiori.packingList.push({ id: 'pack-' + Date.now(), text, link, checked: false });
  saveAllToCloud();
  renderApp();
}

function deletePackingItem(shioriId, idx) {
  const shiori = localShioris.find(s => s.id === shioriId);
  shiori.packingList.splice(idx, 1);
  saveAllToCloud();
  renderApp();
}

// 3. 最後のDayで右から左へスワイプし2秒維持で自動Day追加
let holdTimer = null;
let touchStartX = 0;

function setupSnapScrollListener() {
  setTimeout(() => {
    const container = document.getElementById('snap-scroll-container');
    if (!container) return;

    container.addEventListener('scroll', () => {
      const cardWidth = container.firstElementChild ? container.firstElementChild.offsetWidth : 300;
      const newIdx = Math.round(container.scrollLeft / cardWidth);
      if (newIdx !== currentDayIdx && newIdx >= 0 && newIdx < container.children.length) {
        currentDayIdx = newIdx;
      }
    });

    // 3. 長押しフリック（2秒ホールド）検出
    const startTouch = (e) => {
      touchStartX = e.touches ? e.touches[0].clientX : e.clientX;
      if (holdTimer) clearTimeout(holdTimer);
    };

    const moveTouch = (e) => {
      const currentX = e.touches ? e.touches[0].clientX : e.clientX;
      const diffX = touchStartX - currentX; // 右から左への移動量

      const maxScrollLeft = container.scrollWidth - container.clientWidth;
      const isAtEnd = container.scrollLeft >= maxScrollLeft - 10;

      // 最後のDayかつ右から左へフリック中(diffX > 30)
      if (isAtEnd && diffX > 30) {
        if (!holdTimer) {
          holdTimer = setTimeout(() => {
            addDay(currentShioriId);
            alert('新しいDayを追加しました！');
            holdTimer = null;
          }, 2000); // 2秒間ホールド
        }
      } else {
        if (holdTimer) {
          clearTimeout(holdTimer);
          holdTimer = null;
        }
      }
    };

    const endTouch = () => {
      if (holdTimer) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    };

    container.addEventListener('touchstart', startTouch, { passive: true });
    container.addEventListener('touchmove', moveTouch, { passive: true });
    container.addEventListener('touchend', endTouch, { passive: true });
    container.addEventListener('mousedown', startTouch);
    container.addEventListener('mousemove', moveTouch);
    container.addEventListener('mouseup', endTouch);
  }, 100);
}

function scrollToDay(idx) {
  currentDayIdx = idx;
  renderApp();
  setTimeout(() => {
    const container = document.getElementById('snap-scroll-container');
    if (container && container.children[idx]) {
      container.children[idx].scrollIntoView({ behavior: 'smooth', inline: 'center' });
    }
  }, 50);
}