// Initialize shopping list from localStorage or empty array
let shoppingList = JSON.parse(localStorage.getItem('shoppingList')) || [];

// Function to save list to localStorage
function saveList() {
    localStorage.setItem('shoppingList', JSON.stringify(shoppingList));
}

// Function to render the shopping list
function renderList() {
    const listElement = document.getElementById('shoppingList');
    listElement.innerHTML = '';
    
    shoppingList.forEach((item, index) => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div class="item-content" onclick="toggleItem(${index})">
                <input type="checkbox" id="item${index}" ${item.checked ? 'checked' : ''} onchange="event.stopPropagation()">
                <span class="${item.checked ? 'checked' : ''}">${item.text}</span>
            </div>
            <button onclick="removeItem(${index})">Remove</button>
        `;
        listElement.appendChild(li);
    });
}

// Function to add a new item
function addItem() {
    const input = document.getElementById('itemInput');
    const item = input.value.trim();
    
    if (item) {
        shoppingList.push({ text: item, checked: false });
        saveList();
        renderList();
        input.value = '';
    }
}

// Function to toggle item checked state
function toggleItem(index) {
    shoppingList[index].checked = !shoppingList[index].checked;
    saveList();
    renderList();
}

// Function to remove an item
function removeItem(index) {
    shoppingList.splice(index, 1);
    saveList();
    renderList();
}

// Function to clear all items
function clearList() {
    if (confirm('Are you sure you want to clear all items?')) {
        shoppingList = [];
        saveList();
        renderList();
    }
}

// Function to share the list
function shareList() {
    const text = shoppingList.map(item => `${item.checked ? '✓' : '○'} ${item.text}`).join('\n');
    if (navigator.share) {
        navigator.share({
            title: 'My Shopping List',
            text: text
        }).catch(console.error);
    } else {
        // Fallback for browsers that don't support Web Share API
        const textarea = document.createElement('textarea');
        textarea.value = text;
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        alert('Shopping list copied to clipboard!');
    }
}

// Add event listener for Enter key
document.getElementById('itemInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addItem();
    }
});

// Initial render
renderList(); 