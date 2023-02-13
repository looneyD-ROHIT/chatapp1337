const socket = io();

const currentUser = document.getElementById('currentuser').innerText
socket.emit('setUser', currentUser);


let currentRoom = 'chatapp1337';

const nameOfUser = document.querySelector('.username').innerText;

const textarea = document.querySelector('#textarea')
const messageArea = document.querySelector('.message__area')

textarea.addEventListener('keyup', (e) => {
    if(e.key === 'Enter') {
        sendMessage(e.target.value)
    }
})

function sendMessage(message) {
    message = `${message}`.trim();
    if(!message) {
        textarea.value = '';
        return;
    }
    // let msg = {
    //     user: nameOfUser,
    //     message: message.trim()
    // }
    // Append 
    appendMessage(message, nameOfUser, 'outgoing')
    textarea.value = ''
    scrollToBottom()

    // Send to server 
    socket.emit('message', {message, user: nameOfUser})


    // furthermore save the messages to server
    saveMessages({
        message,
        sentBy: currentUser,
        sentTo: currentRoom,
    })

}

function appendMessage(message, user, type) {
    let mainDiv = document.createElement('div')
    let classnameOfUser = type
    mainDiv.classList.add(classnameOfUser, 'message')

    let markup = `
        <h4>${user}</h4>
        <p>${message}</p>
    `
    mainDiv.innerHTML = markup
    messageArea.appendChild(mainDiv)
}

// Recieve messages 
socket.on('message', (message) => {
    appendMessage(message.message, message.user, 'incoming')
    scrollToBottom()
})

function scrollToBottom() {
    messageArea.scrollTop = messageArea.scrollHeight
}

// adding user to the chatroom for a specific user
(function addingUserToChat(){

    const addUserButton = document.querySelector('.adduserbutton');
    addUserButton.addEventListener('click', (e)=>{
        e.preventDefault();
        const modal = document.querySelector(`.modal`);
        console.log(modal);
        // console.log(`${button.dataset.modalTarget}`);
        openModal(modal);

    })

    const closeModalButton = document.querySelector('.close-button');

    closeModalButton.addEventListener('click', (e)=>{
        e.preventDefault();
        const modal = document.querySelector(`.modal`);
        closeModal(modal);
    })

    const overlay = document.getElementById('overlay');

    overlay.addEventListener('click', (e)=>{
        const modals = document.querySelectorAll('.modal.active');
        modals.forEach(modal => {
            closeModal(modal);
        })
    })

    function openModal(modal){
        if(!modal) return;
        modal.classList.add('active');
        overlay.classList.add('active');
    }

    function closeModal(modal){
        if(!modal) return;
        modal.classList.remove('active');
        overlay.classList.remove('active');
    }

    const sendUserButton = document.getElementById('addsendbutton');
    const sendUser = document.getElementById('addusername');

    sendUserButton.addEventListener('click', (e)=>{
        e.preventDefault();
        // console.log(sendUser.value)
        // console.log(sendUser)
        fetch('/adduser',{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: sendUser.value
            })
        })
        .then(res => res.json())
        .then(res => {
            console.log(res);
            closeModalButton.click()
            
        })
        .catch(err => {
            console.log(err);
        })
    })

})();

// connecting to a specific room
(function connectingRoom(){
    const buttonToJoinRoom = Array.from(document.getElementsByClassName('connection'));
    // console.log(buttonToJoinRoom)
    buttonToJoinRoom.forEach(button => button.addEventListener('click', (e)=>{
        e.preventDefault();


        // apply appropriate css to chat selected
        const chatList = Array.from(document.getElementsByTagName('li'));
        chatList.forEach(chat => {
            if(chat == e.target){
                chat.setAttribute('active', '');
            }else{
                chat.removeAttribute('active');
            }
        });

        messageArea.innerHTML = '';
        
        const roomId = button.getAttribute('id');
        // console.log(roomName);


        // joining the specific room
        currentRoom = roomId;
        // console.log('current room: ', currentRoom)
        socket.emit('join', `${roomId}`);
        
        // fetch the messages sent previously

        fetch('/getroommessages', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomid: roomId
            })
        })
        .then(res => res.json())
        .then(res => {
            console.log(res);
            if(res.status!='success') return;
            const messageList = res.messages.sort((a, b) => a.createdAt - b.createdAt);
            messageList.forEach(message => {
                if(message.sentBy == currentUser){
                    appendMessage(message.message, message.sentByName, 'outgoing');
                }else{
                    appendMessage(message.message, message.sentByName, 'incoming');
                }
            })
        })
        .catch(err => {
            console.log(err);
        })
        
    }));    
})();

// console.log('current room: ', currentRoom)
// save messages for a particular room
function saveMessages(data){
    // console.log(data);
    const message = data.message;
    const username = data.sentBy;
    const roomid = data.sentTo;

    fetch('/roommessages', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            message,
            name: nameOfUser,
            username,
            roomid,
        })
    })
    .then(res => {
        // console.log(res);
        return res.json();
    })
    .then(res => {
        console.log(res);
    })
    .catch(err => {
        console.log(err);
    })
}

// logout
(function logout(){
    const logoutButton = document.getElementById('logout');
    logoutButton.addEventListener('click', (e)=>{
        // e.preventDefault();
        location.href = '/logout';
    })
})();