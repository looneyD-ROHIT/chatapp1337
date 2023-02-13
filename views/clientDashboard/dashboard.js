// LOGOUT button
document.getElementById('logout').addEventListener('click', (e)=>{
    e.preventDefault();
    location.href = '/logout'
})

// UPLOAD Files specific work
const form = document.getElementById("form");

form.addEventListener("submit", submitForm);

function submitForm(e) {
    e.preventDefault();
    const filesTag = document.getElementById("files");
    const formData = new FormData();
    for(let i =0; i < filesTag.files.length; i++) {
            formData.append("files", files.files[i]);
    }

    fetch("/upload", {
        method: 'POST',
        body: formData,
    })
    .then(res => res.json())
    .then(res => {
        if(res.status=='success'){
            location.href = '/dashboard';
        }else{
            // insert HTML to show a popup that result was not success
            // TODO
        }
    })
    .catch((err) => ("Error occured", err));
}


// VIEWING the uploaded files
let uploadedFilesList = 0;
const filesDivOuter = document.getElementById('filesDivOuter')
// console.log(filesDivOuter)
// console.log(filesDivOuter.getAttribute('data-userid'))
// console.log(filesDivOuter.getAttribute('data-username'))

const filesuserid = filesDivOuter.getAttribute('data-userid');
const filesusername = filesDivOuter.getAttribute('data-username');


fetch("/retrieve", {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({
        filesuserid,
        filesusername
    }),
})
.then(res => res.json())
.then(res => {
    console.log(res)
    if(res.status=='success'){
        const filesList = res.filesList;
        if(filesList && filesList.length>0){
            let htmlData = ``;
            filesList.forEach(file => {
                let objData = ``;
                let fileExt = `${file}`.split('.');
                fileExt = fileExt[fileExt.length - 1]
                console.log(fileExt);
                
                
                objData = `<object class="fileObj" data="./uploads/${filesuserid}/${file}"></object>`
                
                objData =  `<div class="modal" id="f${filesuserid}-${file.split('.')[0]}">
                                <div class="modal-header">
                                    <div class="title">${file}</div>
                                    <button data-close-button="#f${filesuserid}-${file.split('.')[0]}" class="close-button">&times;</button>
                                </div>
            
                                <div class="modal-body">
                                    ${objData}
                                </div>
                            </div>
                            `

                htmlData += `<div class="fileObjDiv">${objData}<div>${file}</div><button data-modal-target="#f${filesuserid}-${file.split('.')[0]}" class="download-btn submit-btn view-btn">View</button><a href="./uploads/${filesuserid}/${file}" download="${file}" class="download-btn submit-btn">Download</a></div>`
            });

            // <object class="fileObj" data="./uploads/${filesuserid}/${file}" width="auto" height="auto" style="object-fit:cover"></object>

            // <embed class="fileObj" src="./uploads/${filesuserid}/${file}" width="auto" height="auto" style="object-fit:cover"></embed>

            // <a href="./uploads/${filesuserid}/${file}" download="${file}">Download</a>
    
            filesDivOuter.innerHTML =`<h1 class="innerHeading" >Files Uploaded previously: </h1>` + `<div class="filesDiv" id="filesDiv" >${htmlData}</div>`;
        }else{
            filesDivOuter.innerHTML = `<h1 class="innerHeading" style="text-align: center;margin-bottom: 20px;color: rgb(35, 61, 62);">No Files Uploaded previously: </h1>`;
        }

        const openModalButtons = document.querySelectorAll('[data-modal-target]');

        const closeModalButtons = document.querySelectorAll('[data-close-button]');

        const overlay = document.getElementById('overlay');


        openModalButtons.forEach(button => {
            button.addEventListener('click', (e)=>{
                e.preventDefault();
                const modal = document.querySelector(`${button.dataset.modalTarget}`);
                console.log(modal);
                console.log(`${button.dataset.modalTarget}`);
                openModal(modal);
            })
        })

        closeModalButtons.forEach(button => {
            button.addEventListener('click', (e)=>{
                e.preventDefault();
                // const modal = button.closest('.modal');
                const modal = document.querySelector(`${button.dataset.closeButton}`);
                closeModal(modal);
            })
        })

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

    }else{
        // If status is failure ask user to refresh the page
        filesDivOuter.style.display = "block";
        filesDivOuter.innerHTML = `<div class="notfoundspan"><div class="generaldiv">The files (if uploaded) did not load correctly or No such file exists.</div><div class="generaldiv">Click below to refresh.</div><button id="refresh" class="submit-btn refresh">Refresh</button></div>`
        document.getElementById('refresh').addEventListener('click', (e)=>{
            e.preventDefault();
            location.reload();
        })
    }
})
.catch((err) => ("Error occured", err));

