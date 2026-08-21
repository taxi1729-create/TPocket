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
let editingSpotInfo = null; // { dayIdx, spotIdx }
let editingGroupId = null;
let editingHeader = false;
let editingDayIdx = null;

const defaultIcons = ['✈️', '🏨', '🍽️', '☕', '🚗', '📸', '🛍️', '🏖️', '温泉', '🎟️'];

db.ref('appData').on('value', (snapshot) => {
  const data = snapshot.val();
  if (data) {
    localGroups = data.groups || {};
    localShioris = data.shioris ? Object.keys(data.shioris).map(k => ({ id: k, ...data.shioris[k] })) : [];
  } else {
    const initialData = {
      groups: {
        'default-group': { name: 'メイン旅行グループ', pass: '1234', members: ['自分', 'パートナー'] },
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
            { dayNum: 1, title: 'Day 1', memo: '空港集合は余裕を持って！', spots: [] },
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
  editingSpotInfo = null;
  editingGroupId = null;
  editingHeader = false;
  editingDayIdx = null;
  renderApp();
  window.scrollTo(0, 0);
}

function formatDateLabel(startDateStr, dayOffset) {
  if (!startDateStr) return '';
  const d = new Date(startDateStr);
  d.setDate(d.getDate() + dayOffset);
  return `(${d.getMonth() + 1}/${d.getDate()})`;
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

// 1 & 2. ホーム画面（黒固定ヘッダー ＆ グループメンバー編集）
function renderHomeScreen() {
  const currentGroup = localGroups[currentGroupId] || { name: '未選択', members: [] };
  const groupShioris = localShioris.filter(s => s.groupId === currentGroupId);

  return `
    <!-- 1. スクロールしても固定表示される黒いトップヘッダー -->
    <div class="sticky top-0 z-40 bg-slate-900 text-white px-4 py-3 shadow-md flex items-center justify-between">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white"><i class="fa-solid fa-plane-departure text-sm"></i></div>
        <div>
          <h1 class="text-sm font-black tracking-wide leading-none">TPocket</h1>
          <p class="text-[10px] text-slate-400 font-medium leading-tight mt-0.5">${currentGroup.name}</p>
        </div>
      </div>
      <button onclick="navigateTo('groupAuth')" class="text-xs bg-slate-800 border border-slate-700 text-slate-200 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5 hover:bg-slate-700">
        <i class="fa-solid fa-gear"></i> グループ切替・設定
      </button>
    </div>

    <div class="p-4 space-y-5">
      <!-- 2. グループメンバー編集セクション -->
      <div class="bg-slate-100 border rounded-2xl p-3.5 space-y-2">
        <div class="flex items-center justify-between">
          <span class="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <i class="fa-solid fa-users text-blue-600"></i> グループメンバー
          </span>
          <span class="text-[10px] text-slate-400">旅行内で担当者として選択可能</span>
        </div>
        <div class="flex flex-wrap gap-1.5 items-center">
          ${(currentGroup.members || []).map((m, mIdx) => `
            <span class="text-xs bg-white border border-slate-200 px-2.5 py-1 rounded-full font-bold text-slate-700 flex items-center gap-1.5 shadow-sm">
              ${m}
              <button onclick="deleteGroupMember('${currentGroupId}', ${mIdx})" class="text-slate-300 hover:text-red-500"><i class="fa-solid fa-xmark text-[10px]"></i></button>
            </span>
          `).join('')}
          <div class="flex items-center gap-1 mt-1 w-full">
            <input type="text" id="add-member-input" placeholder="メンバー名を追加" class="flex-1 text-xs border rounded-lg p-1.5 bg-white">
            <button onclick="addGroupMember('${currentGroupId}')" class="bg-blue-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg">追加</button>
          </div>
        </div>
      </div>

      <button onclick="createNewShiori()" class="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold py-3.5 px-4 rounded-2xl shadow-lg flex items-center justify-center gap-2">
        <i class="fa-solid fa-plus"></i><span>新規旅行をつくる</span>
      </button>

      <div class="space-y-3">
        <div class="flex items-center justify-between">
          <h2 class="text-xs font-bold text-slate-600 flex items-center gap-1.5"><i class="fa-solid fa-folder-closed text-blue-500"></i> 旅行一覧</h2>
          <span class="text-xs text-slate-400 font-bold">${groupShioris.length}件</span>
        </div>
        
        <div class="space-y-3">
          ${groupShioris.map(s => `
            <div onclick="navigateTo('detail', '${s.id}')" class="bg-white border rounded-2xl overflow-hidden shadow-sm cursor-pointer hover:shadow-md transition-all">
              <div class="h-28 bg-slate-100 relative">
                <img src="${s.headerImg || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'}" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                <div class="absolute bottom-3 left-3 right-3 text-white">
                  <span class="text-[10px] bg-white/20 backdrop-blur-md px-2 py-0.5 rounded-full font-medium">${s.destination || '目的地未定'}</span>
                  <h3 class="font-bold text-sm mt-1 truncate">${s.title}</h3>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function addGroupMember(gId) {
  const input = document.getElementById('add-member-input');
  if (!input || !input.value.trim()) return;
  if (!localGroups[gId].members) localGroups[gId].members = [];
  localGroups[gId].members.push(input.value.trim());
  saveAllToCloud();
  renderApp();
}

function deleteGroupMember(gId, idx) {
  if (localGroups[gId] && localGroups[gId].members) {
    localGroups[gId].members.splice(idx, 1);
    saveAllToCloud();
    renderApp();
  }
}

function renderGroupAuthScreen() {
  return `
    <div class="p-5 space-y-6">
      <div class="flex items-center justify-between border-b pb-3">
        <button onclick="navigateTo('home')" class="text-xs font-bold text-blue-600"><i class="fa-solid fa-arrow-left"></i> 戻る</button>
        <h2 class="font-bold text-base">グループ管理</h2>
        <div></div>
      </div>
      <div class="space-y-3">
        ${Object.keys(localGroups).map(gId => {
          const g = localGroups[gId];
          const isCurrent = gId === currentGroupId;
          return `
            <div class="bg-white border rounded-2xl p-4 flex flex-col gap-2 ${isCurrent ? 'border-blue-500 ring-2 ring-blue-100' : ''}">
              <div class="flex items-center justify-between">
                <span class="font-bold text-sm">${g.name} ${isCurrent ? '<span class="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full ml-2">選択中</span>' : ''}</span>
                <button onclick="authAndEditGroup('${gId}')" class="text-[10px] text-slate-500 bg-slate-100 px-2 py-1 rounded">編集</button>
              </div>
              ${editingGroupId === gId ? `
                <div class="mt-2 p-3 bg-slate-50 border rounded-xl space-y-2">
                  <label class="text-[10px] font-bold text-slate-500">名称変更</label>
                  <input type="text" id="edit-g-name-${gId}" value="${g.name}" class="w-full border text-xs rounded p-2">
                  <label class="text-[10px] font-bold text-slate-500">パスワード変更</label>
                  <input type="password" id="edit-g-pass-${gId}" value="${g.pass}" class="w-full border text-xs rounded p-2">
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

function renderDetailScreen() {
  const shiori = localShioris.find(s => s.id === currentShioriId);
  if (!shiori) return '...';

  const group = localGroups[shiori.groupId || currentGroupId] || { members: ['全員'] };
  const groupMembers = group.members && group.members.length > 0 ? group.members : ['全員'];

  if (!shiori.packingList) shiori.packingList = [];
  if (shiori.showPackingList === undefined) shiori.showPackingList = true;

  return `
    <div class="relative bg-slate-50 min-h-screen flex flex-col">
      <!-- 1. 黒い固定ヘッダー (スクロールしても常に旅行タイトルと旅行一覧を表示) -->
      <div class="sticky top-0 z-40 bg-slate-900 text-white px-4 py-3 flex justify-between items-center shadow-md">
        <button onclick="navigateTo('home')" class="text-xs font-bold flex items-center gap-1 text-slate-200 hover:text-white">
          <i class="fa-solid fa-arrow-left"></i> 旅行一覧
        </button>
        <span class="text-xs font-black truncate max-w-[180px] text-center">${shiori.title}</span>
        <button onclick="showAllScheduleModal = true; renderApp();" class="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded-lg font-bold">
          全一覧
        </button>
      </div>

      <!-- ヘッダー画像・タイトル表示 -->
      <div class="relative bg-slate-800 text-white">
        <div class="h-40 w-full relative overflow-hidden">
          <img src="${shiori.headerImg || 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80'}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent"></div>
        </div>

        <div class="absolute bottom-3 left-4 right-4 flex items-end justify-between">
          <div>
            <span class="text-[10px] bg-blue-600/80 backdrop-blur-md text-white px-2.5 py-0.5 rounded-full font-bold">${shiori.destination || '目的地未設定'}</span>
            <h1 class="text-base font-black mt-1 leading-snug drop-shadow">${shiori.title}</h1>
          </div>
          <button onclick="editingHeader = true; renderApp();" class="bg-white/20 backdrop-blur-md text-white border border-white/40 text-xs px-2.5 py-1 rounded-xl font-bold"><i class="fa-solid fa-pen"></i> 編集</button>
        </div>
      </div>

      <!-- ヘッダー情報編集モーダル -->
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
      <div class="bg-white p-3.5 border-b space-y-2">
        <div class="flex items-center justify-between">
          <button onclick="togglePackingList('${shiori.id}')" class="font-bold text-xs text-slate-800 flex items-center gap-1.5">
            <i class="fa-solid fa-suitcase text-blue-600"></i>
            <span>持ち物リスト (${shiori.packingList.filter(p=>p.checked).length}/${shiori.packingList.length})</span>
            <i class="fa-solid ${shiori.showPackingList ? 'fa-chevron-up' : 'fa-chevron-down'} text-[10px] text-slate-400"></i>
          </button>
        </div>

        ${shiori.showPackingList ? `
          <div class="space-y-2 pt-1">
            <div class="space-y-1 max-h-36 overflow-y-auto">
              ${shiori.packingList.length === 0 ? '<div class="text-[11px] text-slate-400 italic">持ち物がありません</div>' : ''}
              ${shiori.packingList.map((item, pIdx) => `
                <div class="flex items-center justify-between bg-slate-50 p-1.5 rounded-lg text-xs">
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
            <div class="flex items-center gap-1.5 pt-1 border-t">
              <input type="text" id="new-pack-text" placeholder="持ち物名" class="flex-1 border text-xs rounded-lg p-1.5 bg-slate-50">
              <input type="text" id="new-pack-link" placeholder="URL(任意)" class="w-24 border text-xs rounded-lg p-1.5 bg-slate-50">
              <button onclick="addPackingItem('${shiori.id}')" class="bg-blue-600 text-white font-bold text-xs px-2.5 py-1.5 rounded-lg">追加</button>
            </div>
          </div>
        ` : ''}
      </div>

      <!-- 開始日設定 & Dayタブ -->
      <div class="bg-white p-3 border-b space-y-2">
        <div class="flex justify-between items-center text-xs font-bold text-slate-600">
          <label class="flex items-center gap-1">
            <i class="fa-regular fa-calendar-days text-blue-600"></i> 開始日:
            <input type="date" value="${shiori.startDate || '2026-09-10'}" onchange="updateStartDate('${shiori.id}', this.value)" class="bg-slate-100 border rounded px-1.5 py-0.5 text-xs font-bold">
          </label>
          <button onclick="addDay('${shiori.id}')" class="text-xs bg-blue-50 text-blue-600 px-2.5 py-1 rounded-lg font-bold border border-blue-200">+ Day追加</button>
        </div>

        <!-- 4. 日付表記付き Day1(9/10), Day2(9/11) タブ -->
        <div class="flex gap-2 overflow-x-auto hide-scrollbar pt-1">
          ${shiori.days.map((d, idx) => {
            const dateStr = formatDateLabel(shiori.startDate, idx);
            return `
              <button onclick="scrollToDay(${idx})" class="px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap ${currentDayIdx === idx ? 'bg-blue-600 text-white shadow' : 'bg-slate-100 text-slate-600'}">
                ${d.title || ('Day ' + (idx + 1))}${dateStr}
              </button>
            `;
          }).join('')}
        </div>

        <!-- 5. 開始日・Dayタブの下に配置された単一のスワイプ案内メッセージ -->
        <div class="text-center pt-1">
          <span class="text-[10px] text-slate-400 font-bold bg-slate-100 px-3 py-1 rounded-full"><i class="fa-solid fa-arrows-left-right text-blue-500 mr-1"></i>左右スワイプで日程を切り替えられます</span>
        </div>
      </div>

      <!-- シームレス横スワイプエリア -->
      <div id="snap-scroll-container" class="flex overflow-x-auto snap-x snap-mandatory hide-scrollbar w-full py-4 gap-3 px-4">
        ${shiori.days.map((day, dIdx) => {
          const dateStr = formatDateLabel(shiori.startDate, dIdx);
          return `
            <div class="snap-center shrink-0 w-[88vw] max-w-[370px] bg-slate-100/80 border rounded-3xl p-3.5 space-y-3 shadow-sm flex flex-col justify-between">
              <div>
                <!-- 4. Dayタイトルの横に編集ボタン（タイトル変更、メモ、削除） -->
                <div class="flex items-center justify-between border-b pb-2 mb-2">
                  <div>
                    <span class="font-black text-slate-800 text-sm">${day.title || ('Day ' + (dIdx + 1))} ${dateStr}</span>
                    ${day.memo ? `<p class="text-[11px] text-slate-500 font-medium mt-0.5">${day.memo}</p>` : ''}
                  </div>
                  <button onclick="openDayEditModal(${dIdx})" class="text-xs bg-white text-slate-600 border px-2 py-1 rounded-lg font-bold shadow-sm hover:bg-slate-50 flex items-center gap-1">
                    <i class="fa-solid fa-gear text-slate-400"></i> Day編集
                  </button>
                </div>

                <!-- スポット一覧 -->
                <div class="space-y-2.5">
                  ${(!day.spots || day.spots.length === 0) ? `
                    <div class="text-center py-8 bg-white rounded-2xl border border-dashed text-xs text-slate-400">予定がありません</div>
                  ` : day.spots.map((spot, sIdx) => `
                    <div class="bg-white rounded-2xl p-3 border shadow-sm space-y-1.5">
                      <div class="flex justify-between items-center">
                        <div class="flex items-center gap-1.5">
                          <span class="text-base">${spot.icon || '✈️'}</span>
                          <span class="text-xs font-bold bg-blue-50 text-blue-600 px-2 py-0.5 rounded-lg">${spot.time}</span>
                          ${spot.assignedMember ? `<span class="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">👤 ${spot.assignedMember}</span>` : ''}
                        </div>
                        <div class="flex gap-1.5">
                          <button onclick="openEditSpot('${shiori.id}', ${dIdx}, ${sIdx})" class="text-blue-600 text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded"><i class="fa-solid fa-pen"></i></button>
                          <button onclick="deleteSpot('${shiori.id}', ${dIdx}, ${sIdx})" class="text-slate-300 hover:text-red-500 text-xs p-1"><i class="fa-solid fa-trash"></i></button>
                        </div>
                      </div>
                      <h3 class="font-bold text-sm text-slate-800">${spot.title}</h3>
                      ${spot.memo ? `<p class="text-xs text-slate-500 bg-slate-50 p-2 rounded-lg">${spot.memo}</p>` : ''}
                      ${spot.link ? `
                        <a href="${spot.link}" target="_blank" class="inline-flex items-center gap-1 text-[11px] text-blue-600 font-bold bg-blue-50 px-2 py-1 rounded-md">
                          <i class="fa-solid fa-arrow-up-right-from-square"></i> 関連リンク
                        </a>
                      ` : ''}
                      ${spot.imgUrl ? `<div class="rounded-xl overflow-hidden border max-h-40 mt-1"><img src="${spot.imgUrl}" class="w-full h-full object-cover"></div>` : ''}
                    </div>
                  `).join('')}
                </div>
              </div>

              <!-- 3. 予定作成フォーム (画像添付の下にリンク欄・メンバー選択欄・全員ボタン) -->
              <div class="bg-blue-50/80 border border-blue-200 rounded-2xl p-3 space-y-2 mt-3">
                <h4 class="text-[11px] font-bold text-blue-900"><i class="fa-solid fa-plus-circle text-blue-600"></i> ${day.title || ('Day ' + (dIdx+1))} に予定を追加</h4>
                
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
                   <span class="text-slate-500 font-bold">画像添付</span>
                   <input type="file" id="input-img-file-${dIdx}" accept="image/*" class="text-[9px]">
                </div>

                <!-- 3. 画像添付の下にリンク欄 -->
                <input type="text" id="input-link-${dIdx}" placeholder="関連リンクURL (http...)" class="w-full border text-xs rounded-lg p-1.5 bg-white">

                <!-- 3. 担当メンバー選択 (デフォルト全員 / 全員ボタン追加) -->
                <div class="space-y-1">
                  <div class="flex items-center justify-between">
                    <label class="text-[10px] font-bold text-slate-500">担当メンバー</label>
                    <button type="button" onclick="document.getElementById('input-member-${dIdx}').value='全員'" class="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">全員ボタン</button>
                  </div>
                  <select id="input-member-${dIdx}" class="w-full border text-xs rounded-lg p-1.5 bg-white font-bold">
                    <option value="全員" selected>全員</option>
                    ${groupMembers.map(m => `<option value="${m}">${m}</option>`).join('')}
                  </select>
                </div>

                <button onclick="addSpotInline('${shiori.id}', ${dIdx})" class="w-full bg-blue-600 text-white font-bold py-2 rounded-xl text-xs shadow">追加する</button>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    </div>

    ${showAllScheduleModal ? renderAllScheduleModal(shiori) : ''}
    ${editingSpotInfo !== null ? renderEditSpotModal(shiori) : ''}
    ${editingDayIdx !== null ? renderDayEditModal(shiori) : ''}
  `;
}

// 4. Day編集モーダル (タイトル変更、メモ、削除)
function openDayEditModal(dIdx) {
  editingDayIdx = dIdx;
  renderApp();
}

function renderDayEditModal(shiori) {
  const day = shiori.days[editingDayIdx];
  return `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
        <div class="flex justify-between border-b pb-2">
          <h3 class="font-bold text-sm">Day ${editingDayIdx + 1} の編集</h3>
          <button onclick="editingDayIdx = null; renderApp();" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
        </div>

        <div class="space-y-3">
          <div>
            <label class="text-[10px] font-bold text-slate-500">タイトル変更</label>
            <input type="text" id="edit-day-title" value="${day.title || ('Day ' + (editingDayIdx + 1))}" class="w-full border text-xs rounded p-2">
          </div>

          <div>
            <label class="text-[10px] font-bold text-slate-500">メモ欄</label>
            <textarea id="edit-day-memo" rows="2" class="w-full border text-xs rounded p-2" placeholder="この日の注意事項など">${day.memo || ''}</textarea>
          </div>
        </div>

        <div class="space-y-2 pt-2 border-t">
          <button onclick="saveDayEdit('${shiori.id}')" class="w-full bg-blue-600 text-white font-bold py-2 rounded-xl text-xs">変更を保存</button>
          <button onclick="deleteDay('${shiori.id}', ${editingDayIdx})" class="w-full bg-red-50 text-red-600 font-bold py-2 rounded-xl text-xs border border-red-200"><i class="fa-solid fa-trash mr-1"></i> Day予定を削除</button>
        </div>
      </div>
    </div>
  `;
}

function saveDayEdit(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  const day = shiori.days[editingDayIdx];
  day.title = document.getElementById('edit-day-title').value;
  day.memo = document.getElementById('edit-day-memo').value;
  editingDayIdx = null;
  saveAllToCloud();
  renderApp();
}

function deleteDay(shioriId, dIdx) {
  if (confirm('このDayを削除しますか？登録されている予定も削除されます。')) {
    const shiori = localShioris.find(s => s.id === shioriId);
    shiori.days.splice(dIdx, 1);
    editingDayIdx = null;
    currentDayIdx = 0;
    saveAllToCloud();
    renderApp();
  }
}

// 3. 予定編集モーダル (リンク欄・メンバー選択欄・全員ボタン)
function openEditSpot(sId, dIdx, sIdx) {
  editingSpotInfo = { dayIdx: dIdx, spotIdx: sIdx };
  renderApp();
}

function renderEditSpotModal(shiori) {
  const { dayIdx, spotIdx } = editingSpotInfo;
  const spot = shiori.days[dayIdx].spots[spotIdx];
  const [hh, mm] = spot.time.split(':');

  const group = localGroups[shiori.groupId || currentGroupId] || { members: ['全員'] };
  const groupMembers = group.members && group.members.length > 0 ? group.members : ['全員'];

  return `
    <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-2xl">
        <div class="flex justify-between border-b pb-2">
          <h3 class="font-bold text-sm">予定の編集</h3>
          <button onclick="editingSpotInfo = null; renderApp();" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
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
              <select id="edit-hour" class="time-picker-select text-xs">${Array.from({length:24}).map((_,h) => { const hs = String(h).padStart(2,'0'); return `<option value="${hs}" ${hs === hh ? 'selected' : ''}>${hs}</option>`; }).join('')}</select>
              <span>:</span>
              <select id="edit-minute" class="time-picker-select text-xs">${['00','15','30','45'].map(m => `<option value="${m}" ${m === mm ? 'selected' : ''}>${m}</option>`; }).join('')}</select>
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

          <!-- 3. 画像の下のリンク欄 -->
          <div>
            <label class="text-[10px] font-bold text-slate-500">関連リンク</label>
            <input type="text" id="edit-link" value="${spot.link || ''}" placeholder="URL (http...)" class="w-full border text-xs rounded p-2">
          </div>

          <!-- 3. 担当メンバー選択 (全員ボタンあり) -->
          <div class="space-y-1">
            <div class="flex items-center justify-between">
              <label class="text-[10px] font-bold text-slate-500">担当メンバー</label>
              <button type="button" onclick="document.getElementById('edit-member').value='全員'" class="text-[10px] bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-bold">全員ボタン</button>
            </div>
            <select id="edit-member" class="w-full border text-xs rounded p-2 font-bold">
              <option value="全員" ${spot.assignedMember==='全員'?'selected':''}>全員</option>
              ${groupMembers.map(m => `<option value="${m}" ${spot.assignedMember===m?'selected':''}>${m}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="flex gap-2 pt-2">
          <button onclick="saveEditSpot('${shiori.id}')" class="flex-1 bg-blue-600 text-white font-bold py-2 rounded-xl text-xs">変更を保存</button>
        </div>
      </div>
    </div>
  `;
}

function saveEditSpot(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  const { dayIdx, spotIdx } = editingSpotInfo;
  const spot = shiori.days[dayIdx].spots[spotIdx];
  
  spot.icon = document.getElementById('edit-icon').value || '✈️';
  spot.time = document.getElementById('edit-hour').value + ':' + document.getElementById('edit-minute').value;
  spot.title = document.getElementById('edit-title').value || '無題';
  spot.memo = document.getElementById('edit-memo').value;
  spot.link = document.getElementById('edit-link').value;
  spot.assignedMember = document.getElementById('edit-member').value || '全員';

  handleImageUpload('edit-img-file', (base64Img) => {
    if (document.getElementById('edit-img-delete') && document.getElementById('edit-img-delete').checked) {
      spot.imgUrl = '';
    } else if (base64Img) {
      spot.imgUrl = base64Img;
    }
    shiori.days[dayIdx].spots.sort((a,b) => a.time.localeCompare(b.time));
    editingSpotInfo = null;
    saveAllToCloud();
    renderApp();
  });
}

function addSpotInline(shioriId, dIdx) {
  const title = document.getElementById('input-title-' + dIdx).value;
  if (!title) return alert('予定名を入力してください');
  
  const shiori = localShioris.find(s => s.id === shioriId);
  const time = document.getElementById('input-hour-' + dIdx).value + ':' + document.getElementById('input-minute-' + dIdx).value;
  const memo = document.getElementById('input-memo-' + dIdx).value;
  const icon = document.getElementById('input-icon-' + dIdx).value || '✈️';
  const link = document.getElementById('input-link-' + dIdx).value;
  const assignedMember = document.getElementById('input-member-' + dIdx).value || '全員';

  handleImageUpload('input-img-file-' + dIdx, (base64Img) => {
    shiori.days[dIdx].spots.push({
      id: 'spot-' + Date.now(),
      icon, time, title, memo, link, assignedMember,
      imgUrl: base64Img || ''
    });
    shiori.days[dIdx].spots.sort((a,b) => a.time.localeCompare(b.time));
    saveAllToCloud();
    renderApp();
  });
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

function setupSnapScrollListener() {
  setTimeout(() => {
    const container = document.getElementById('snap-scroll-container');
    if (!container) return;
    container.addEventListener('scroll', () => {
      const cardWidth = container.firstElementChild ? container.firstElementChild.offsetWidth : 300;
      const newIdx = Math.round(container.scrollLeft / cardWidth);
      if (newIdx !== currentDayIdx && newIdx >= 0) {
        currentDayIdx = newIdx;
      }
    });
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

function renderAllScheduleModal(shiori) {
  return `
    <div class="fixed inset-0 z-50 bg-black/80 flex flex-col justify-end">
      <div class="bg-white rounded-t-3xl h-[85vh] p-4 flex flex-col">
        <div class="flex justify-between items-center border-b pb-2 mb-3">
          <h3 class="font-bold text-sm">全日程スケジュール</h3>
          <button onclick="showAllScheduleModal=false;renderApp();" class="text-slate-400"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="flex gap-3 overflow-x-auto flex-1 items-start bg-slate-100 p-3 rounded-2xl">
          ${shiori.days.map((day, idx) => `
            <div class="min-w-[240px] max-w-[240px] bg-white rounded-xl p-3 border shadow-sm space-y-2 max-h-full overflow-y-auto">
              <span class="font-bold text-xs text-blue-600">${day.title || ('Day ' + (idx + 1))}</span>
              <div class="space-y-2">
                ${day.spots.map(s => `
                  <div class="bg-slate-50 p-2 rounded text-xs">
                    <span class="font-bold text-blue-600 text-[10px]">${s.time}</span> ${s.icon}
                    <div class="font-bold">${s.title}</div>
                    ${s.assignedMember ? `<div class="text-[9px] text-amber-700">👤 ${s.assignedMember}</div>` : ''}
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

function authAndSwitchGroup(gId) {
  const inputPass = document.getElementById('pass-' + gId).value;
  if (localGroups[gId].pass === inputPass) {
    currentGroupId = gId; localStorage.setItem('tpocket_group_id', gId); navigateTo('home');
  } else { alert('パスワードが正しくありません'); }
}

function authAndEditGroup(gId) {
  const pass = prompt('編集用パスワードを入力してください:');
  if (pass === null) return;
  if (localGroups[gId].pass === pass) {
    editingGroupId = gId; renderApp();
  } else { alert('パスワードが違います'); }
}

function saveEditedGroup(gId) {
  const newName = document.getElementById('edit-g-name-' + gId).value;
  const newPass = document.getElementById('edit-g-pass-' + gId).value;
  if(!newName || !newPass) return alert('入力不足です');
  localGroups[gId].name = newName; localGroups[gId].pass = newPass;
  editingGroupId = null; saveAllToCloud(); renderApp();
}

function deleteGroup(gId) {
  if(confirm('グループを削除しますか？')) {
    delete localGroups[gId];
    if(currentGroupId === gId) currentGroupId = Object.keys(localGroups)[0] || null;
    editingGroupId = null; saveAllToCloud(); renderApp();
  }
}

function createNewGroup() {
  const name = document.getElementById('new-group-name').value;
  const pass = document.getElementById('new-group-pass').value || '1234';
  if (!name) return alert('入力してください');
  const newGId = 'group-' + Date.now();
  localGroups[newGId] = { name, pass, members: ['自分', 'パートナー'] }; currentGroupId = newGId; localStorage.setItem('tpocket_group_id', newGId); saveAllToCloud(); navigateTo('home');
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

function deleteSpot(shioriId, dayIdx, spotIdx) {
  localShioris.find(s => s.id === shioriId).days[dayIdx].spots.splice(spotIdx, 1); saveAllToCloud(); renderApp();
}

function updateStartDate(shioriId, val) {
  localShioris.find(s => s.id === shioriId).startDate = val; saveAllToCloud(); renderApp();
}

function addDay(shioriId) {
  const shiori = localShioris.find(s => s.id === shioriId);
  const nextNum = shiori.days.length + 1;
  shiori.days.push({ dayNum: nextNum, title: 'Day ' + nextNum, memo: '', spots: [] });
  saveAllToCloud(); renderApp();
}
