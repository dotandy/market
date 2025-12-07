# 北農每日菜價查詢系統 - 安裝與使用教學

這份教學將引導您如何在您的電腦上安裝並執行「北農每日菜價查詢系統」。

## 1. 環境準備 (Prerequisites)

在開始之前，請確保您的電腦已安裝 **Node.js**。

-   **檢查是否已安裝**：
    打開終端機 (Terminal) 或命令提示字元 (Command Prompt)，輸入以下指令：
    ```bash
    node -v
    ```
    如果有出現版本號 (例如 `v18.17.0`)，代表已安裝。

-   **如果未安裝**：
    請前往 [Node.js 官網](https://nodejs.org/) 下載並安裝 **LTS (Long Term Support)** 版本。

## 2. 下載專案 (Download Project)

將此專案下載到您的電腦中。

-   如果您有使用 Git：
    ```bash
    git clone <專案網址>
    cd Beinong_daily_quote
    ```
-   或者直接下載 ZIP 壓縮檔並解壓縮，然後使用終端機進入該資料夾。

## 3. 安裝依賴套件 (Install Dependencies)

在專案資料夾中，執行以下指令來安裝所需的程式庫 (包含 Next.js, Puppeteer, Tailwind CSS 等)：

```bash
npm install
```

> ⏳ 這個過程可能需要幾分鐘，請耐心等待。

## 4. 啟動服務 (Start the Service)

安裝完成後，執行以下指令來啟動開發伺服器：

```bash
npm run dev
```

當您看到以下訊息時，代表服務已成功啟動：
```
> ready started server on 0.0.0.0:3000, url: http://localhost:3000
```

## 5. 開始使用 (Usage)

打開您的瀏覽器 (Chrome, Edge, Firefox 等)，前往網址：

**[http://localhost:3000](http://localhost:3000)**

### 功能介紹

1.  **查詢菜價 (Fetch Data)**：
    -   輸入日期 (民國年，例如 `114/12/03`)。
    -   選擇類別 (蔬菜或水果)。
    -   點擊 **Fetch Data** 按鈕。
    -   系統會自動從北農網站抓取資料。如果抓取失敗，會嘗試讀取備份資料。

2.  **匯入 Excel (Import Excel)**：
    -   如果您有從北農網站下載的 Excel 檔案，可以點擊 **Import Excel** 按鈕直接匯入。

3.  **編輯資料 (Edit Data)**：
    -   表格中的數據都可以直接點擊修改。
    -   您可以點擊右上角的 **Add Row** 新增一列。
    -   點擊每一列右側的垃圾桶圖示可刪除該列。

4.  **匯出報表 (Export)**：
    -   **Export PNG**：將目前的表格存為圖片。
    -   **Export PDF**：將目前的表格存為 PDF 文件。

## 常見問題 (FAQ)

-   **Q: 為什麼抓不到資料？**
    A: 北農網站可能有防爬蟲機制或暫時無法連線。系統會自動嘗試讀取本地備份。您也可以手動下載 Excel 並使用匯入功能。

-   **Q: 備份資料存在哪裡？**
    A: 抓取成功的資料會自動備份在專案目錄下的 `data/backup/` 資料夾中。
