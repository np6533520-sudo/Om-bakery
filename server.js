const express = require('express');
const fs = require('fs');
const cron = require('node-cron');
const axios = require('axios');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static('public')); // फ्रंटएंड फाइल्स के लिए

const DATA_FILE = path.join(__dirname, 'customers.json');

// व्हाट्सएप API क्रेडेंशियल्स (इन्हें अपने Meta डैशबोर्ड से बदलें)
const WHATSAPP_TOKEN = "YOUR_META_PERMANENT_ACCESS_TOKEN"; 
const PHONE_NUMBER_ID = "YOUR_WHATSAPP_PHONE_NUMBER_ID"; 

// डेटाबेस फाइल लोड या क्रिएट करना
if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([]));
}

// 1. नए कस्टमर का डेटा सेव करने का API पॉइंट
app.post('/api/add-customer', (req, res) => {
    const { name, phone, cake, date } = req.body;
    
    if (!name || !phone || !cake || !date) {
        return res.status(400).json({ success: false, message: "सभी जानकारी भरें!" });
    }

    const customers = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    customers.push({ name, phone, cake, date });
    fs.writeFileSync(DATA_FILE, JSON.stringify(customers, null, 2));

    res.json({ success: true, message: "कस्टमर का डेटा सुरक्षित सेव हो गया है!" });
});

// 2. ऑटोमैटिक मैसेज भेजने का फंक्शन (WhatsApp API कॉल)
async function sendWhatsAppTemplate(customer) {
    const url = `https://graph.facebook.com/v21.0/${PHONE_NUMBER_ID}/messages`;
    
    const payload = {
        messaging_product: "whatsapp",
        to: customer.phone, // देश के कोड के साथ (जैसे 919876543210)
        type: "template",
        template: {
            name: "om_bakery_birthday",
            language: { code: "hi" },
            components: [
                {
                    type: "body",
                    parameters: [
                        { type: "text", text: customer.name }, // {{1}} की जगह
                        { type: "text", text: customer.cake }  // {{2}} की जगह
                    ]
                }
            ]
        }
    };

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${WHATSAPP_TOKEN}`,
                'Content-Type': 'application/json'
            }
        });
        console.log(`मैसेज भेज दिया गया: ${customer.name} (${response.data.messages[0].id})`);
    } catch (error) {
        console.error(`मैसेज भेजने में गड़बड़ हुई (${customer.name}):`, error.response ? error.response.data : error.message);
    }
}

// 3. CRON JOB: रोज़ सुबह 10:00 बजे अपने आप चलने वाला शेड्यूलर
cron.schedule('0 10 * * *', () => {
    console.log("रोज़ाना बर्थडे चेक शुरू हो रहा है...");
    const customers = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    
    const today = new Date();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    customers.forEach(customer => {
        const pDate = new Date(customer.date);
        
        // अगर आज वही तारीख और महीना है (चाहे साल कोई भी हो)
        if (pDate.getMonth() === todayMonth && pDate.getDate() === todayDate) {
            sendWhatsAppTemplate(customer);
        }
    });
});

// सर्वर चालू करें
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`ओम बेकरी ऐप सर्वर पोर्ट ${PORT} पर लाइव है!`);
});
