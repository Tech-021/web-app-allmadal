export type Language = "en" | "ur";

export interface TranslationDictionary {
  [key: string]: {
    en: string;
    ur: string;
  };
}

export const translations: TranslationDictionary = {
  // ================= NAVIGATION LINKS =================
  "nav.dashboard": { en: "Dashboard", ur: "Dashboard (Khulasa)" },
  "nav.sales": { en: "Sales", ur: "Bikri / POS" },
  "nav.products": { en: "Products", ur: "Samaan (Products)" },
  "nav.products_inventory": { en: "Products / Inventory", ur: "Samaan / Inventory" },
  "nav.all_products": { en: "All Products", ur: "Tamam Samaan" },
  "nav.categories": { en: "Categories", ur: "Aqsaam (Categories)" },
  "nav.stock": { en: "Stock", ur: "Mojooda Stock" },
  "nav.stock_levels": { en: "Stock Levels", ur: "Stock Ki Tafseel" },
  "nav.accounts": { en: "Cash / Accounts", ur: "Rokarr / Khata Accounts" },
  "nav.customers": { en: "Customers / Khata", ur: "Grahak (Customers Khata)" },
  "nav.suppliers": { en: "Suppliers", ur: "Suppliers (Beopari)" },
  "nav.expenses": { en: "Expenses", ur: "Rozana Akhrajat" },
  "nav.imei": { en: "IMEI Management", ur: "IMEI Mobile Record" },
  "nav.payments": { en: "Payments / Billing", ur: "Billing & Plans" },
  "nav.invoices": { en: "Invoices / Receipts", ur: "Raseedein / Invoices" },
  "nav.daily_closing": { en: "Daily Closing", ur: "Rozana Hisab Closing" },
  "nav.reports": { en: "Reports & Balance Sheet", ur: "Reports (Munafa / Nuqsan)" },
  "nav.staff": { en: "Staff & Permissions", ur: "Mulazmeen (Staff)" },
  "nav.logs": { en: "Activity Logs", ur: "Karwai Record Logs" },
  "nav.settings": { en: "Settings", ur: "Tarteebat (Settings)" },

  // ================= SHELL & BRANDING =================
  "shell.store_management": { en: "Store Management", ur: "Dukaan Management" },
  "shell.tagline": { en: "Apni Dukaan Ko Asaan Banayein", ur: "Apni Dukaan Ko Asaan Banayein" },
  "shell.active_plan": { en: "Active Plan", ur: "Active Plan" },
  "shell.free_trial": { en: "30-Day Free Trial", ur: "30 Din Free Trial" },
  "shell.days_remaining": { en: "days remaining", ur: "din baqi hain" },
  "shell.active_trial": { en: "Active Trial", ur: "Active Trial" },
  "shell.subscribe": { en: "Subscribe", ur: "Upgrade Karein" },
  "shell.billing": { en: "Billing", ur: "Billing" },
  "shell.no_active_business": { en: "No active business", ur: "Koi dukaan muntakhib nahi" },
  "shell.setup_business": { en: "+ Set up your business", ur: "+ Nayi dukaan banayein" },
  "shell.more": { en: "More", ur: "Mazeed" },
  "shell.sign_out": { en: "Sign out", ur: "Logout Karein" },
  "shell.loading": { en: "Loading Almadel workspace...", ur: "Almadel load ho raha hai..." },

  // ================= USER ROLES =================
  "role.owner": { en: "Store Owner", ur: "Dukaan Malik" },
  "role.staff": { en: "Staff Member", ur: "Mulazim (Staff)" },
  "role.accountant": { en: "Accountant", ur: "Munshi / Accountant" },

  // ================= COMMON UI ACTIONS =================
  "action.add_product": { en: "+ Add product", ur: "+ Naya Samaan Dalein" },
  "action.export_csv": { en: "📥 Export CSV", ur: "📥 CSV Download Karein" },
  "action.import_csv": { en: "📤 Import CSV", ur: "📤 CSV Upload Karein" },
  "action.refresh": { en: "Refresh", ur: "Taaza Karein" },
  "action.search": { en: "Search...", ur: "Talaash karein..." },
  "action.save": { en: "Save", ur: "Mehfooz Karein" },
  "action.save_changes": { en: "Save changes", ur: "Tabdeeli Mehfooz Karein" },
  "action.cancel": { en: "Cancel", ur: "Mansookh" },
  "action.delete": { en: "Delete", ur: "Khatam Karein" },
  "action.edit": { en: "Edit", ur: "Tabdeeli" },
  "action.print": { en: "Print", ur: "Print Karein" },
  "action.print_receipt": { en: "Print Receipt", ur: "Raseed Print Karein" },
  "action.complete_sale": { en: "Complete Sale", ur: "Bill Mukammal Karein" },
  "action.new_sale": { en: "New Sale", ur: "+ Naya Bill Banayein" },
  "action.upload_logo": { en: "Upload Logo", ur: "Logo Lagayein" },
  "action.change_logo": { en: "Change Logo", ur: "Logo Badlein" },
  "action.remove_logo": { en: "Remove", ur: "Khatam Karein" },
  "action.back": { en: "Back", ur: "Wapas" },
  "action.submit": { en: "Submit", ur: "Jama Karein" },

  // ================= FINANCIAL & POS TERMS =================
  "term.total": { en: "Total", ur: "Kul Raqam" },
  "term.subtotal": { en: "Subtotal", ur: "Total Samaan" },
  "term.paid": { en: "Paid", ur: "Ada Shuda" },
  "term.balance": { en: "Balance", ur: "Baqaya" },
  "term.change": { en: "Change Due", ur: "Baqaya Wapsi" },
  "term.discount": { en: "Discount", ur: "Choot (Discount)" },
  "term.cash": { en: "Cash", ur: "Naqd (Cash)" },
  "term.online": { en: "Online / Bank", ur: "Online / Bank" },
  "term.credit": { en: "Credit / Udhaar", ur: "Udhaar (Khata)" },
  "term.customer": { en: "Customer", ur: "Grahak" },
  "term.supplier": { en: "Supplier", ur: "Beopari (Supplier)" },
  "term.quantity": { en: "Quantity", ur: "Tadaad" },
  "term.price": { en: "Price", ur: "Qeemat" },
  "term.cost_price": { en: "Cost Price", ur: "Kharid Qeemat" },
  "term.selling_price": { en: "Selling Price", ur: "Farokht Qeemat" },
  "term.barcode": { en: "Barcode", ur: "Barcode" },
  "term.stock": { en: "In Stock", ur: "Mojood Maal" },
  "term.low_stock": { en: "Low Stock", ur: "Kam Stock" },
  "term.out_of_stock": { en: "Out of Stock", ur: "Stock Khatam" },

  // ================= DASHBOARD TERMS =================
  "dashboard.title": { en: "Dashboard", ur: "Dashboard (Dukaan Ka Khulasa)" },
  "dashboard.subtitle": { en: "Business performance, live sales, and quick metrics.", ur: "Dukaan ki karkardagi, live bikri aur ahem hisab kitab." },
  "dashboard.today_sales": { en: "Today's Sales", ur: "Aaj Ki Bikri" },
  "dashboard.total_sales": { en: "Total Sales", ur: "Kul Bikri" },
  "dashboard.total_orders": { en: "Total Invoices", ur: "Kul Bills / Invoices" },
  "dashboard.low_stock": { en: "Low Stock Items", ur: "Kam Stock Wali Ashya" },
  "dashboard.cash_in_hand": { en: "Cash in Hand", ur: "Galla / Rokarr" },
  "dashboard.customer_receivable": { en: "Customer Udhaar", ur: "Grahak Udhaar (Wasool Talab)" },
  "dashboard.supplier_payable": { en: "Supplier Udhaar", ur: "Supplier Udhaar (Wajib-ul-Ada)" },
  "dashboard.sales_overview": { en: "Sales Overview", ur: "Bikri Ka Jaiza (Sales Overview)" },
  "dashboard.last_7_days": { en: "Last 7 days", ur: "Pichle 7 Din" },
  "dashboard.weekly": { en: "Weekly", ur: "Haftawar" },
  "dashboard.recent_sales": { en: "Recent Invoices", ur: "Haaliya Bills / Invoices" },
  "dashboard.no_sales": { en: "No sales recorded yet.", ur: "Abhi tak koi bill nahi bana." },
  "dashboard.quick_actions": { en: "Quick Actions", ur: "Fauri Karwaiyan" },

  // ================= POS TERMINAL & COUNTER =================
  "pos.title": { en: "POS Sales Terminal", ur: "POS Counter (Bikri Terminal)" },
  "pos.subtitle": { en: "Fast barcode checkout, cash receipting, and instant billing.", ur: "Tez tareen barcode billing aur raseed print." },
  "pos.scanner_input": { en: "Scan barcode or search product name...", ur: "Barcode scan karein ya samaan ka naam likhein..." },
  "pos.cart": { en: "Current Bill (Cart)", ur: "Mojooda Bill (Cart)" },
  "pos.cart_empty": { en: "No items in cart. Scan a barcode to start.", ur: "Cart khaali hai. Barcode scan karein ya item chunein." },
  "pos.clear_cart": { en: "Clear Bill", ur: "Bill Saaf Karein" },
  "pos.walk_in": { en: "Walk-in Customer", ur: "Aam Grahak (Walk-in)" },
  "pos.customer_name": { en: "Customer Name", ur: "Grahak Ka Naam" },
  "pos.customer_mobile": { en: "Mobile Number", ur: "Mobile Number" },
  "pos.received_cash": { en: "Cash Tendered / Received", ur: "Wasool Shuda Raqam" },
  "pos.change_return": { en: "Change to Return", ur: "Baqaya Wapsi" },
  "pos.complete_btn": { en: "Complete Sale (Bill Banayein)", ur: "Bill Mukammal Karein (Bill Banayein)" },
  "pos.select_payment": { en: "Select Payment Method", ur: "Adaigi Ka Tareeqa Chunein" },
  "pos.scan_camera": { en: "📷 Camera Scanner", ur: "📷 Camera Scanner" },
  "pos.scan_camera_tip": { en: "Scan barcode with mobile camera or webcam", ur: "Mobile camera ya webcam se barcode scan karein" },

  // ================= CAMERA BARCODE SCANNER =================
  "scanner.title": { en: "Camera Barcode & QR Scanner", ur: "Camera Barcode & QR Scanner" },
  "scanner.subtitle": { en: "Point device camera at any retail product barcode or QR code.", ur: "Apne mobile ya webcam camera ko product barcode ya QR code ke samnay rakhein." },
  "scanner.open": { en: "📷 Scan with Camera", ur: "📷 Camera Se Scan Karein" },
  "scanner.continuous": { en: "Continuous POS Scan", ur: "Musalsal Scan (Tez POS)" },
  "scanner.flip_camera": { en: "Flip Camera", ur: "Camera Badlein" },
  "scanner.not_found": { en: "Product not found for scanned barcode", ur: "Is barcode ka koi samaan daryaft nahi hua" },
  "scanner.added_success": { en: "Added to bill successfully", ur: "Kamyabi se bill mein shamil kar diya gaya" },

  // ================= CUSTOMERS & KHATA =================
  "customers.title": { en: "Customers & Khata", ur: "Grahak & Khata Register" },
  "customers.subtitle": { en: "Manage customer ledgers, credit balances, and collections.", ur: "Grahakon ka udhaar khata aur wasooli check karein." },
  "customers.add_btn": { en: "+ Add Customer", ur: "+ Naya Grahak Shamil Karein" },
  "customers.total_udhaar": { en: "Total Customer Udhaar", ur: "Kul Grahak Udhaar (Receivable)" },
  "customers.receive_payment": { en: "Receive Payment (Vasooli)", ur: "Wasooli Jama Karein" },

  // ================= SUPPLIERS =================
  "suppliers.title": { en: "Suppliers & Vendors", ur: "Suppliers & Beopari Khata" },
  "suppliers.subtitle": { en: "Track purchase accounts and supplier payables.", ur: "Kharidari aur supplier baqaya check karein." },
  "suppliers.pay_btn": { en: "Pay Supplier", ur: "Supplier Ko Adaigi Karein" },

  // ================= DAILY CLOSING =================
  "closing.title": { en: "Daily Closing", ur: "Rozana Hisab Closing" },
  "closing.subtitle": { en: "Reconcile daily sales, cash drawer, and recorded payments.", ur: "Rozana bikri aur galla match karke hisab band karein." },
  "closing.expected": { en: "System Expected Cash", ur: "System Ke Mutabiq Rokarr" },
  "closing.actual": { en: "Actual Cash Counted", ur: "Galla Mein Mojood Naqd" },
  "closing.submit": { en: "Close Day & Save", ur: "Rozana Hisab Band Karein" },
  "closing.total_sales_bills": { en: "Total Sales Bills", ur: "Kul Bikri Bills" },
  "closing.net_sales_value": { en: "Net Sales Value", ur: "Kul Net Bikri" },
  "closing.expected_cash": { en: "Expected Cash in Hand", ur: "Mutawaqqa Galla (Cash)" },
  "closing.reconciliation_diff": { en: "Reconciliation Difference", ur: "Farq (Galla Match)" },
  "closing.close_cash_drawer": { en: "Close Cash Drawer for This Day", ur: "Aaj Ka Galla / Hisab Band Karein" },
  "closing.day_closed": { en: "Day Successfully Closed", ur: "Aaj Ka Hisab Mukammal Band Hai" },
  "closing.physical_cash": { en: "Physical Counted Cash (PKR)", ur: "Galla Mein Mojood Ginni Gayi Raqam (PKR)" },
  "closing.reconciliation_note": { en: "Reconciliation Note (Optional)", ur: "Wazahatan / Note (Ikhtiyari)" },
  "closing.submit_btn": { en: "Submit Daily Closing", ur: "Rozana Closing Jama Karein" },
  "closing.closing_btn": { en: "Closing Day...", ur: "Hisab Band Ho Raha Hai..." },

  // ================= EXPENSES =================
  "expenses.title": { en: "Expenses", ur: "Rozana Akhrajat" },
  "expenses.subtitle": { en: "Track daily shop overhead, utilities, and minor costs.", ur: "Dukaan ke rozana kharche aur bills darj karein." },
  "expenses.add_btn": { en: "+ Record Expense", ur: "+ Naya Kharcha Darj Karein" },

  // ================= INVOICES & RECEIPTS =================
  "invoices.title": { en: "Invoices / Receipts", ur: "Raseedein & Invoices" },
  "invoices.subtitle": { en: "Search, reprint, and review customer sales history.", ur: "Pichli raseedein aur bikri ka record check karein." },
  "invoices.search_placeholder": { en: "Search by invoice number or customer name...", ur: "Invoice number ya grahak ke naam se talaash karein..." },
  "receipt.thank_you": { en: "Thank you for your business!", ur: "Aapki aamad ka shukriya!" },
  "receipt.paid_status": { en: "PAID", ur: "ADA SHUDA (PAID)" },
  "receipt.credit_status": { en: "UDHAAR", ur: "UDHAAR (CREDIT)" },

  // ================= CATEGORIES & STOCK =================
  "categories.title": { en: "Categories", ur: "Ashya Ki Aqsaam (Categories)" },
  "categories.add_btn": { en: "+ Add Category", ur: "+ Nayi Qisam Shamil Karein" },
  "stock.title": { en: "Stock Levels", ur: "Mojooda Stock Ki Tafseel" },
  "stock.all_stock": { en: "All Stock", ur: "Tamam Stock" },
  "stock.low_stock": { en: "Low Stock", ur: "Kam Stock" },
  "stock.out_of_stock": { en: "Out of Stock", ur: "Stock Khatam" },

  // ================= TABLE HEADERS & GENERAL DATA =================
  "table.name": { en: "Name", ur: "Naam" },
  "table.mobile": { en: "Mobile", ur: "Mobile Number" },
  "table.email": { en: "Email", ur: "Email" },
  "table.current_balance": { en: "Current Balance", ur: "Mojooda Baqaya (Balance)" },
  "table.total_spent": { en: "Total Spent", ur: "Kul Kharidari" },
  "table.amount": { en: "Amount", ur: "Raqam" },
  "table.category": { en: "Category", ur: "Qisam (Category)" },
  "table.description": { en: "Description", ur: "Tafseel / Wazahatan" },
  "table.account": { en: "Account", ur: "Khata Account" },
  "table.type": { en: "Type", ur: "Qisam (Type)" },
  "table.opening_balance": { en: "Opening Balance", ur: "Ibtidayi Baqaya" },
  "table.balance": { en: "Balance", ur: "Baqaya" },
  "table.invoice_number": { en: "Invoice #", ur: "Invoice #" },
  "table.date": { en: "Date & Time", ur: "Tareekh o Waqt" },
  "table.customer": { en: "Customer", ur: "Grahak" },
  "table.total_amount": { en: "Total Amount", ur: "Kul Raqam" },
  "table.payment_mode": { en: "Payment Mode", ur: "Adaigi Ka Zariya" },
  "table.actions": { en: "Actions", ur: "Karwaiyan" },
  "table.no_records": { en: "No records found.", ur: "Koi record nahi mila." },
  "table.view": { en: "📄 View", ur: "📄 Raseed Dekhein" },
  "table.previous": { en: "Previous", ur: "Pichla (Previous)" },
  "table.next": { en: "Next", ur: "Agla (Next)" },
  "table.page": { en: "Page", ur: "Safha" },
  "table.of": { en: "of", ur: "ka" },
  "form.select_account": { en: "Select Account", ur: "Khata Account Chunein" },
  "form.saving": { en: "Saving...", ur: "Mehfooz Ho Raha Hai..." },
  "form.close": { en: "Close", ur: "Band Karein" },

  // ================= AUTH =================
  "auth.welcome_back": { en: "Welcome back", ur: "Khushamdeed" },
  "auth.login": { en: "Login Karein", ur: "Login Karein" },
  "auth.signing_in": { en: "Signing in...", ur: "Dakhil ho rahe hain..." },
  "auth.forgot_password": { en: "Forgot Password?", ur: "Password Bhool Gaye?" },
  "auth.remember_me": { en: "Remember me", ur: "Mujhe yaad rakhein" },
  "auth.email": { en: "Email address", ur: "Email pata" },
  "auth.password": { en: "Password", ur: "Password" },
  "auth.new_account": { en: "Naya Account Banayein", ur: "Naya Account Banayein" },
  "auth.already_account": { en: "Already have an account?", ur: "Pehle se account hai?" },
  "auth.sign_in": { en: "Sign in", ur: "Sign in Karein" },
};

export function getTranslation(key: string, lang: Language, fallback?: string): string {
  const item = translations[key];
  if (!item) return fallback || key;
  return item[lang] || item.en || fallback || key;
}
