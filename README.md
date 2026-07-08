# Bluetooth Command Test

ブラウザの Web Bluetooth API でBLEデバイスへ文字列コマンドを送るテストです。

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
