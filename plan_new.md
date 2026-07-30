# Master Excel & Live Google Sheets Integration Plan

Based on the structure of your provided `Campus Dining NITER.xlsx` file, here is the action plan to fully automate your master tracking sheet.

### 📥 1. The "Master Excel" Download Feature
We will add a new **"Download Master Excel"** button inside the Admin Dashboard. When you click it, the system will use the live database to instantly generate and download an `.xlsx` file that mimics your old manual tracker.

**The generated Excel will include:**
1. **Student Info:** SL, Name, Department, Dining ID
2. **Financials:** Deposits (Total Deposits), Total Cost (Meals × Rate), and On-Hand (Remaining Balance).
3. **The Daily Grid:** A day-by-day matrix showing **Lunch (L)** and **Dinner (D)** for every day of the active dining period. It will automatically fill in `1` for ON and `0` for OFF/Auto-Disabled based on the students' actual meal schedules and auto-off statuses.
4. **Totals:** Total Meal counts.

---

### 📊 2. The "Live Google Sheet" (Magic Integration)
Instead of building a complicated system that pushes data to Google (which requires complex Google Cloud API keys and service accounts that can expire), we will use a much smarter, zero-maintenance method!

**How it will work:**
1. I will build a secure, live-data link (e.g., `https://your-website.com/api/admin/live-sheet?secret=YOUR_SECRET_KEY`). 
2. You will open a blank Google Spreadsheet and type this exact formula into the first cell (A1):
   `=IMPORTDATA("https://your-website.com/api/admin/live-sheet?secret=YOUR_SECRET_KEY")`
3. **That's it!** Google Sheets will automatically call our website in the background and populate the spreadsheet with all the live data (Deposits, Costs, Balances, and Meal Counts).
4. Google automatically refreshes `IMPORTDATA` periodically, meaning anyone with the Google Sheet link will always see the real-time data without you ever having to manually click export or upload anything.

### 🚀 Next Steps
If you are happy with this plan, click the **Proceed** button to let me know, and I will begin implementing the code for both the Excel Exporter and the Live CSV API endpoint!
