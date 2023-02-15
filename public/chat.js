const socket = io();

const currentUser = document.getElementById('currentuser').innerText
socket.emit('setUser', currentUser);


let currentRoom = {
    'name': 'chatapp1337',
    'isroom': true
};

let currentRoomList = [];

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
    const time = new Date();
    appendMessage(message, nameOfUser, 'outgoing', time.toLocaleString('en-IN', {'dateStyle': 'short', 'timeStyle': 'medium'}));
    textarea.value = ''
    scrollToBottom()

    // Send to server 
    console.log('current room: '+currentRoom);
    socket.emit('message', {message, user: nameOfUser, room: currentRoom.name, isroom: currentRoom.isroom})


    // furthermore save the messages to server
    if(currentRoom.isroom){
        console.log('saving room message')
        saveMessages({
            message,
            sentBy: currentUser,
            sentTo: currentRoom.name,
        })
    }else{
        console.log('saving private message')
        savePrivateMessages({
            message,
            sentBy: currentUser,
            sentTo: currentRoom.name,
        })
    }

}

function appendMessage(message, user, type, timeStamp) {
    let mainDiv = document.createElement('div')
    let classnameOfUser = type
    mainDiv.classList.add(classnameOfUser, 'message')

    let markup = `
        <h4>${user} &nbsp; | &nbsp; <span>${timeStamp}</span></h4>
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

// adding specific user to the chat with another user
(function addingUserToPrivateChat(){

    const addUserButton = document.querySelector('.adduserbutton');
    addUserButton.addEventListener('click', (e)=>{
        e.preventDefault();
        const modal = document.querySelector(`.modal`);
        // console.log(modal);
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
            location.reload();
        })
        .catch(err => {
            console.log(err);
        })
    })

})();

// adding specific user to chat in a room
(function addingRoomToUser(){

    const addRoomButton = document.querySelector('#joinorcreate');
    addRoomButton.addEventListener('click', (e)=>{
        e.preventDefault();
        const modal = document.querySelector(`.modal2`);
        // console.log(modal);
        // console.log(`${button.dataset.modalTarget}`);
        openModal(modal);

    })

    const closeModalButton = document.querySelector('.close-button2');

    closeModalButton.addEventListener('click', (e)=>{
        e.preventDefault();
        const modal = document.querySelector(`.modal2`);
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

    const roomSendButton = document.getElementById('roomsendbutton');

    const roomname = document.getElementById('roomname');
    const roomid = document.getElementById('roomid');

    console.log(roomname.value, roomid.value)

    roomSendButton.addEventListener('click', (e)=>{
        e.preventDefault();


        
        fetch('/addroom',{
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                roomname: roomname.value,
                roomid: roomid.value
            })
        })
        .then(res => res.json())
        .then(res => {
            // console.log(res);
            closeModalButton.click();
            location.reload();
        })
        .catch(err => {
            console.log(err);
        })
    })
})();


// remove active filter
function removeActiveFilter(){
    const chatList = Array.from(document.getElementsByTagName('li'));
    // console.log(chatList);
    chatList.forEach(chat => {
        if(chat.hasAttribute('active'))
            chat.removeAttribute('active');
    });
}

// connecting to a specific room
(function connectingRoom(){
    const buttonToJoinRoom = Array.from(document.getElementsByClassName('connection'));
    // console.log(buttonToJoinRoom)
    buttonToJoinRoom.forEach(button => {
        if(button.getAttribute('id')){
            currentRoomList.push(button.getAttribute('id'));
            socket.emit('join', `${button.getAttribute('id')}`);
            console.log(button.getAttribute('id') + ' joined...')
        }
    })
    buttonToJoinRoom.forEach(button => { 
        // if(!(button.innerText.indexOf('(G)')>=0)) return;
        return button.addEventListener('click', (e)=>{
                    e.preventDefault();
                    
                    const roomId = button.getAttribute('id');

                    console.log('getting messages for room: ' + roomId);
                    if(button.innerText.indexOf('(G)')>=0){
                        currentRoom.name = roomId;
                        currentRoom.isroom = true;
                    }else{
                        currentRoom.name = roomId;
                        currentRoom.isroom = false;
                    }
                    // console.log('roomID: ' + roomId)
                    // console.log(currentRoom)


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


                        // apply appropriate css to chat selected
                        const chatheading = document.querySelector('#chatheading');
                        const overlayoverall = document.querySelector('#overlayoverall');
                        chatheading.innerText = button.getAttribute('name');
                        overlayoverall.setAttribute('inactive', '');


                        // remove active filter from all chats
                        removeActiveFilter();
                        button.setAttribute('active', '');
                        // console.log(button.getAttribute('name'))
                        // console.log(button.innerText.indexOf('(G)'))



                        messageArea.innerHTML = '';

                        if(res.status!='success'){
                            return;
                        }else{

                            const messageList = res.messages.sort((a, b) => a.createdAt - b.createdAt);
                            messageList.forEach(message => {
                                let sentAt = new Date(message.sentAt);
                                sentAt = sentAt.toLocaleString('en-IN', {'dateStyle': 'short', 'timeStyle': 'medium'});
                                if(message.sentBy == currentUser){
                                    appendMessage(message.message, message.sentByName, 'outgoing', sentAt);
                                }else{
                                    appendMessage(message.message, message.sentByName, 'incoming', sentAt);
                                }
                            })
                            scrollToBottom();
                            console.log('done')
                        }
                    })
                    .catch(err => {
                        console.log(err);
                    })
                    
                })
    
    });    
})();


// save messages for a particular group chat
function saveMessages(data){
    // console.log(data);
    const message = data.message;
    const username = data.sentBy;
    const roomid = data.sentTo;

    fetch('/saveroommessages', {
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

// save messages for a particular private chat
function savePrivateMessages(data){
    // console.log(data);
    const message = data.message;
    const username = data.sentBy;
    const roomid = data.sentTo;
    console.log('saving private messages')
    console.log(message)
    console.log(username)
    console.log(roomid)

    fetch('/saveprivateroommessages', {
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