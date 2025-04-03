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

// Add scanning styles to the document
function addScanningStyles() {
    if (!document.getElementById('scanning-styles')) {
        const style = document.createElement('style');
        style.id = 'scanning-styles';
        style.textContent = `
            .scanning-overlay {
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 70%;
                height: 40%;
                border: 3px solid #00b894;
                border-radius: 8px;
                box-shadow: 0 0 0 2000px rgba(0, 0, 0, 0.5);
                pointer-events: none;
            }
            
            .scanning-message {
                color: white;
                font-size: 1.2rem;
                margin-bottom: 1rem;
                text-align: center;
                padding: 0 1rem;
                z-index: 10;
            }
            
            .scanning-progress {
                width: 80%;
                max-width: 300px;
                height: 4px;
                background-color: rgba(255, 255, 255, 0.2);
                border-radius: 2px;
                margin-top: 1rem;
                overflow: hidden;
                position: relative;
            }
            
            .scanning-progress-bar {
                height: 100%;
                width: 0%;
                background-color: #00b894;
                border-radius: 2px;
                transition: width 0.2s;
            }
        `;
        document.head.appendChild(style);
    }
}

// Improved barcode scanning function
async function startBarcodeScan() {
    try {
        // Create preview container
        const previewContainer = document.createElement('div');
        previewContainer.className = 'camera-preview';
        previewContainer.innerHTML = `
            <div class="scanning-message">Point camera at barcode</div>
            <div class="focus-box"></div>
            <video id="scanner-video" autoplay playsinline></video>
            <button class="cancel-btn">Cancel Scan</button>
        `;
        document.body.appendChild(previewContainer);

        // Get video element
        const video = document.getElementById('scanner-video');

        // Request camera access with better quality settings
        const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                facingMode: 'environment',
                width: { ideal: 1920 },
                height: { ideal: 1080 },
                frameRate: { ideal: 30 },
                focusMode: 'continuous'
            } 
        });

        // Set video source
        video.srcObject = stream;

        // Wait for video to be ready
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                video.play();
                resolve();
            };
        });

        // Initialize ZXing scanner
        const codeReader = new ZXing.BrowserBarcodeReader();
        
        // Set up scanning interval
        const scanInterval = setInterval(async () => {
            try {
                const result = await codeReader.decodeFromVideoElement(video);
                if (result) {
                    console.log('Barcode detected:', result.text);
                    
                    // Only stop scanning if the product lookup is successful
                    try {
                        await lookupProduct(result.text);
                        clearInterval(scanInterval);
                        stream.getTracks().forEach(track => track.stop());
                        previewContainer.remove();
                    } catch (error) {
                        console.error('Error looking up product:', error);
                        // Keep scanning if product lookup fails
                    }
                }
            } catch (error) {
                if (error.message.includes('No MultiFormat Readers were able to detect the code')) {
                    // This is normal when no barcode is detected
                    return;
                }
                console.error('Scanning error:', error);
            }
        }, 500); // Check every 500ms

        // Handle cancel button
        previewContainer.querySelector('.cancel-btn').onclick = () => {
            clearInterval(scanInterval);
            stream.getTracks().forEach(track => track.stop());
            previewContainer.remove();
        };

    } catch (error) {
        console.error('Error accessing camera:', error);
        alert('Error accessing camera. Please ensure you have granted camera permissions and try again.');
    }
}

// Product lookup function
async function lookupProduct(barcode) {
    try {
        // Show loading indicator
        const loadingToast = document.createElement('div');
        loadingToast.className = 'toast loading';
        loadingToast.textContent = 'Looking up product...';
        document.body.appendChild(loadingToast);
        
        const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json`);
        const data = await response.json();
        
        // Remove loading indicator
        loadingToast.remove();
        
        if (data.status === 1 && data.product) {
            const product = data.product;
            let itemName = product.product_name || product.generic_name;
            
            if (!itemName || itemName.trim() === '') {
                itemName = 'Unknown Product (' + barcode + ')';
            }
            
            // Add to shopping list
            shoppingList.push({ 
                text: itemName,
                checked: false
            });
            saveList();
            renderList();
            
            // Show success toast
            const successToast = document.createElement('div');
            successToast.className = 'toast success';
            successToast.textContent = `Added: ${itemName}`;
            document.body.appendChild(successToast);
            
            // Remove toast after 3 seconds
            setTimeout(() => {
                successToast.classList.add('fade-out');
                setTimeout(() => successToast.remove(), 500);
            }, 3000);
            
        } else {
            // Show not found toast
            const errorToast = document.createElement('div');
            errorToast.className = 'toast error';
            errorToast.textContent = 'Product not found. Adding barcode instead.';
            document.body.appendChild(errorToast);
            
            // Add barcode as an item
            shoppingList.push({ 
                text: `Unknown product (${barcode})`,
                checked: false
            });
            saveList();
            renderList();
            
            // Remove toast after 3 seconds
            setTimeout(() => {
                errorToast.classList.add('fade-out');
                setTimeout(() => errorToast.remove(), 500);
            }, 3000);
        }
    } catch (error) {
        console.error('Error looking up product:', error);
        
        // Show error toast
        const errorToast = document.createElement('div');
        errorToast.className = 'toast error';
        errorToast.textContent = 'Error looking up product. Adding barcode instead.';
        document.body.appendChild(errorToast);
        
        // Add barcode as an item
        shoppingList.push({ 
            text: `Unknown product (${barcode})`,
            checked: false
        });
        saveList();
        renderList();
        
        // Remove toast after 3 seconds
        setTimeout(() => {
            errorToast.classList.add('fade-out');
            setTimeout(() => errorToast.remove(), 500);
        }, 3000);
    }
}

// Add toast styles
function addToastStyles() {
    if (!document.getElementById('toast-styles')) {
        const style = document.createElement('style');
        style.id = 'toast-styles';
        style.textContent = `
            .toast {
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                padding: 12px 20px;
                border-radius: 8px;
                color: white;
                font-weight: 500;
                z-index: 1000;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                animation: toast-in 0.3s ease-out;
            }
            
            .toast.loading {
                background-color: #3498db;
            }
            
            .toast.success {
                background-color: #00b894;
            }
            
            .toast.error {
                background-color: #ff6b6b;
            }
            
            .toast.fade-out {
                animation: toast-out 0.5s ease-in forwards;
            }
            
            @keyframes toast-in {
                from { opacity: 0; transform: translate(-50%, 20px); }
                to { opacity: 1; transform: translate(-50%, 0); }
            }
            
            @keyframes toast-out {
                from { opacity: 1; transform: translate(-50%, 0); }
                to { opacity: 0; transform: translate(-50%, 20px); }
            }
        `;
        document.head.appendChild(style);
    }
}

// Add event listener for Enter key
document.getElementById('itemInput').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        addItem();
    }
});

// Initialize
(function init() {
    // Add styles
    addScanningStyles();
    addToastStyles();
    
    // Render initial list
    renderList();
})();