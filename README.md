# Bluetooth Command Test

ブラウザの Web Bluetooth API でBLEデバイスへ文字列コマンドを送るテストです。

## Bluefy + サーバー文字起こし

Bluefyでは標準の音声認識が `service-not-allowed` になることがあるため、短い録音をサーバーへ送って文字起こしするテストを追加しています。

流れ:

1. Bluefyでマイク音声を約2秒録音
2. Supabase Edge Function `transcribe` に送信
3. Edge FunctionからGroq Whisperへ送信
4. 返ってきた文字に犬の名前があれば `BARK`
5. 犬の名前と「おいで」があれば `BARK`, `BARK`, `COME`

公開ページ:

https://mukumuku-bot.github.io/Bluetooth_test/

## Supabase Edge Function の準備

このリポジトリには `supabase/functions/transcribe/index.ts` を入れています。

必要なもの:

- Supabase CLI
- Groq API key

設定する秘密キー:

```bash
supabase secrets set GROQ_API_KEY=ここにGroqのAPIキー
```

デプロイ:

```bash
supabase functions deploy transcribe
```

デプロイ後、ページ内の「文字起こしサーバーURL」が次になっていることを確認してください。

```txt
https://uakzkwotrawatfpwcfbi.supabase.co/functions/v1/transcribe
```

## 対応しやすい環境

- Android Chrome
- Windows Chrome / Edge
- Mac Chrome

iPhone Safari / iPhone Chrome はWeb Bluetooth非対応の可能性が高いです。

## 初期UUID

Nordic UART Service互換のESP32 BLE UARTを想定しています。

- Service UUID: `6e400001-b5a3-f393-e0a9-e50e24dcca9e`
- TX Characteristic UUID: `6e400002-b5a3-f393-e0a9-e50e24dcca9e`

送信されるコマンドは改行付きの文字列です。

```txt
FORWARD
LEFT
RIGHT
BACK
STOP
BARK
```
