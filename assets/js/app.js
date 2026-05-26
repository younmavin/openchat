import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js'
import { getFirestore, collection, addDoc, query, orderBy, limit, onSnapshot, serverTimestamp, doc, setDoc, deleteDoc } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js'
import { getAuth, signInAnonymously } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js'

const firebaseConfig = {
  apiKey: 'AIzaSyC9NZNptW81r9FAl20niuxxSHqmkAtqg8s',
  authDomain: 'mavin-chat.firebaseapp.com',
  projectId: 'mavin-chat',
  storageBucket: 'mavin-chat.firebasestorage.app',
  messagingSenderId: '118162841065',
  appId: '1:118162841065:web:b695c8c6a0be0c9398bf78',
  measurementId: 'G-3M7Z1BVJ9K',
}

// ── Firebase 초기화 ──
const app = initializeApp(firebaseConfig)
const db = getFirestore(app)
const auth = getAuth(app)

// ── 상태 ──
let currentUser = null
let unsubMessages = null
let unsubOnline = null
let lastDate = null

// ── DOM ──
const loginScreen = document.getElementById('login-screen')
const chatScreen = document.getElementById('chat-screen')
const nicknameInput = document.getElementById('nickname-input')
const loginBtn = document.getElementById('login-btn')
const leaveBtn = document.getElementById('leave-btn')
const messagesEl = document.getElementById('messages')
const msgInput = document.getElementById('msg-input')
const sendBtn = document.getElementById('send-btn')
const onlineCount = document.getElementById('online-count')
const onlineToggle = document.getElementById('online-toggle')
const onlineDropdown = document.getElementById('online-dropdown')
const userList = document.getElementById('user-list')

// ── 유틸 ──
function formatTime(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })
}

function formatDate(ts) {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts)
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })
}

function isSameDay(ts1, ts2) {
  if (!ts1 || !ts2) return false
  const d1 = ts1.toDate ? ts1.toDate() : new Date(ts1)
  const d2 = ts2.toDate ? ts2.toDate() : new Date(ts2)
  return d1.toDateString() === d2.toDateString()
}

function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight
}

// ── 로그인 ──
loginBtn.addEventListener('click', handleLogin)
nicknameInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') handleLogin()
})

async function handleLogin() {
  const nickname = nicknameInput.value.trim()
  if (!nickname) {
    nicknameInput.style.borderColor = '#f87171'
    nicknameInput.focus()
    setTimeout(() => (nicknameInput.style.borderColor = ''), 1200)
    return
  }

  loginBtn.disabled = true
  loginBtn.textContent = '입장 중...'

  try {
    const credential = await signInAnonymously(auth)
    const uid = credential.user.uid
    currentUser = { uid, nickname }

    await setDoc(doc(db, 'online', uid), {
      nickname,
      joinedAt: serverTimestamp(),
    })

    await addDoc(collection(db, 'messages'), {
      type: 'system',
      text: `${nickname}님이 입장했습니다.`,
      createdAt: serverTimestamp(),
    })

    enterChat()
  } catch (err) {
    console.error(err)
    alert('입장에 실패했습니다. Firebase 설정을 확인해주세요.')
    loginBtn.disabled = false
    loginBtn.textContent = '입장하기'
  }
}

// ── 채팅방 진입 ──
function enterChat() {
  loginScreen.classList.add('hidden')
  chatScreen.classList.remove('hidden')
  msgInput.focus()

  subscribeMessages()
  subscribeOnline()
  subscribeKicked()
}

// ── 강퇴 감지 ──
// Firebase 콘솔에서 kicked/{uid} 문서를 추가하면 해당 유저가 튕겨남
function subscribeKicked() {
  const kickedRef = doc(db, 'kicked', currentUser.uid)
  onSnapshot(kickedRef, async (snapshot) => {
    if (!snapshot.exists()) return

    // 강퇴 문서가 생성됐을 때
    alert('관리자에 의해 강퇴되었습니다.')

    // 리스너 해제
    unsubMessages?.()
    unsubOnline?.()

    // 강퇴 메시지
    await addDoc(collection(db, 'messages'), {
      type: 'system',
      text: `${currentUser.nickname}님이 강퇴되었습니다.`,
      createdAt: serverTimestamp(),
    })

    // 접속자 목록 제거
    await deleteDoc(doc(db, 'online', currentUser.uid))

    currentUser = null

    // 로그인 화면으로
    chatScreen.classList.add('hidden')
    loginScreen.classList.remove('hidden')
    nicknameInput.value = ''
  })
}

// ── 메시지 실시간 수신 ──
function subscribeMessages() {
  const q = query(collection(db, 'messages'), orderBy('createdAt'), limit(100))

  unsubMessages = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      if (change.type === 'added') renderMessage(change.doc.data())
    })
    scrollToBottom()
  })
}

// ── 접속자 실시간 수신 + 드롭다운 목록 ──
function subscribeOnline() {
  unsubOnline = onSnapshot(collection(db, 'online'), (snapshot) => {
    onlineCount.textContent = snapshot.size

    userList.innerHTML = ''
    snapshot.forEach((d) => {
      const data = d.data()
      const isMe = d.id === currentUser?.uid

      const li = document.createElement('li')
      if (isMe) li.classList.add('is-me')

      const avatar = document.createElement('div')
      avatar.className = 'user-avatar'
      avatar.textContent = data.nickname.charAt(0).toUpperCase()

      const name = document.createElement('span')
      name.className = 'user-name'
      name.textContent = data.nickname

      li.appendChild(avatar)
      li.appendChild(name)
      userList.appendChild(li)
    })
  })
}

// ── 드롭다운 토글 ──
onlineToggle.addEventListener('click', () => {
  const isOpen = onlineDropdown.classList.toggle('open')
  onlineToggle.setAttribute('aria-expanded', isOpen)
})

// 외부 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (!onlineToggle.contains(e.target) && !onlineDropdown.contains(e.target)) {
    onlineDropdown.classList.remove('open')
    onlineToggle.setAttribute('aria-expanded', false)
  }
})

// ── 메시지 렌더링 ──
function renderMessage(data) {
  if (data.createdAt && !isSameDay(data.createdAt, lastDate)) {
    const divider = document.createElement('div')
    divider.className = 'date-divider'
    divider.textContent = formatDate(data.createdAt)
    messagesEl.appendChild(divider)
    lastDate = data.createdAt
  }

  if (data.type === 'system') {
    const el = document.createElement('div')
    el.className = 'system-msg'
    el.textContent = data.text
    messagesEl.appendChild(el)
    return
  }

  const isMe = data.uid === currentUser?.uid

  const lastGroup = messagesEl.querySelector('.msg-group:last-child')
  if (lastGroup && lastGroup.dataset.uid === data.uid && lastGroup.dataset.time === formatTime(data.createdAt)) {
    const bubble = document.createElement('div')
    bubble.className = 'bubble'
    bubble.textContent = data.text
    const row = lastGroup.querySelector('.msg-row')
    const timEl = row.querySelector('.msg-time')
    row.insertBefore(bubble, timEl)
    return
  }

  const group = document.createElement('div')
  group.className = `msg-group ${isMe ? 'me' : 'other'}`
  group.dataset.uid = data.uid
  group.dataset.time = formatTime(data.createdAt)

  if (!isMe) {
    const sender = document.createElement('div')
    sender.className = 'msg-sender'
    sender.textContent = data.sender
    group.appendChild(sender)
  }

  const row = document.createElement('div')
  row.className = 'msg-row'

  const bubble = document.createElement('div')
  bubble.className = 'bubble'
  bubble.textContent = data.text

  const time = document.createElement('div')
  time.className = 'msg-time'
  time.textContent = formatTime(data.createdAt)

  row.appendChild(bubble)
  row.appendChild(time)
  group.appendChild(row)
  messagesEl.appendChild(group)
}

// ── 메시지 전송 ──
sendBtn.addEventListener('click', sendMessage)
msgInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    sendMessage()
  }
})

async function sendMessage() {
  const text = msgInput.value.trim()
  if (!text || !currentUser) return

  msgInput.value = ''
  msgInput.focus()

  try {
    await addDoc(collection(db, 'messages'), {
      type: 'chat',
      text,
      sender: currentUser.nickname,
      uid: currentUser.uid,
      createdAt: serverTimestamp(),
    })
  } catch (err) {
    console.error('전송 실패:', err)
    msgInput.value = text
  }
}

// ── 나가기 ──
leaveBtn.addEventListener('click', leaveChat)
window.addEventListener('beforeunload', cleanUp)

async function leaveChat() {
  await cleanUp()
  location.reload()
}

async function cleanUp() {
  if (!currentUser) return

  unsubMessages?.()
  unsubOnline?.()

  await addDoc(collection(db, 'messages'), {
    type: 'system',
    text: `${currentUser.nickname}님이 퇴장했습니다.`,
    createdAt: serverTimestamp(),
  })

  await deleteDoc(doc(db, 'online', currentUser.uid))

  currentUser = null
}
