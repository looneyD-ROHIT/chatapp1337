// LOGOUT button
document.getElementById('logout').addEventListener('click', (e)=>{
    e.preventDefault();
    location.href = '/logout'
})


// VIEWING the uploaded files
const filesDivOuter = document.getElementById('filesDivOuter')

fetch("/retrieveall", {
    method: 'POST',
})
.then(res => res.json())
.then(res => {
    // console.log(res)
    if(res.status=='success'){
        delete res.status;
        delete res.message;
        // console.log(Object.keys(res));

        const folderList = Object.keys(res);

        if(folderList.length > 0){

            let finalHtmlData = ``;
            let exists = false;
            for(let i=0; i<folderList.length; i++){
                // console.log(folderList[i]);
                const filesList = res[folderList[i]].filesList;
                if(!filesList.length) continue;
                // console.log(filesList)

                let htmlData = ``;

                filesList.forEach(file => {
                    // console.log(file)
                    exists = true;
                    htmlData += `<div class="fileObjDiv"><object class="fileObj" data="./uploads/${folderList[i]}/${file}" width="auto" height="auto" style="object-fit:cover"></object><a href="./uploads/${folderList[i]}/${file}" download="${file}" class="download-btn submit-btn">Download</a><input class="checkbox" type="checkbox" name="${file}" data-folder=${folderList[i]} id="${file}"></input></div>`
                });
        
                htmlData =`<h1 class="innerHeading" >User ${folderList[i]}: </h1>` + `<div class="filesDiv" id="filesDiv" >${htmlData}</div>`;
                finalHtmlData = `<div>${htmlData}</div>` + finalHtmlData;
            }
            if(exists){
                finalHtmlData = `<h1 style="padding:25px">Uploaded Files:</h1>` + finalHtmlData + `<button class="delete-btn" id="delete-btn">Delete</button>`;
                filesDivOuter.innerHTML = finalHtmlData;
            }else{
                filesDivOuter.style.display = "block";
                filesDivOuter.innerHTML = `<div class="notfoundspan"><div class="generaldiv">The files (if uploaded) did not load correctly or No such file exists.</div><div class="generaldiv">Click below to refresh.</div><button id="refresh" class="submit-btn refresh">Refresh</button></div>`
                document.getElementById('refresh').addEventListener('click', (e)=>{
                    e.preventDefault();
                    location.reload();
                })
            }

            // DELETING the uploaded files
            const delete_btn = document.getElementById('delete-btn');
            delete_btn.addEventListener('click', (e)=>{
                e.preventDefault();
                
                const checkboxList = Array.from(document.getElementsByClassName('checkbox'));
                console.log(checkboxList);
                const finalObj = checkboxList.reduce((acc, curr)=>{
                    const flag = curr.checked == true;
                    // console.log(flag);
                    if(flag){
                        const folderName = `${curr.getAttribute('data-folder')}`;
                        const fileName = `${curr.getAttribute('name')}`;
                        if(acc[folderName]){
                            acc[folderName].push(fileName);
                        }else{
                            acc[folderName] = [fileName];
                        }
                    }
                    return acc;
                }, {})

                console.log(finalObj);

                fetch('/admin', {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        finalFilesList: finalObj
                    }),
                })
                .then(res => res.json())
                .then(res => {
                    console.log(res);
                    if(res.status == 'success'){
                        location.reload();
                    }else{
                        // do nothing
                    }
                })
                .catch((err) => ("Error occured while deletion: +", err));
            })

        }else{
            filesDivOuter.innerHTML = `<h1 class="innerHeading" style="text-align: center;margin-bottom: 20px;color: rgb(35, 61, 62);">No folders were Uploaded previously: </h1>`;
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

