#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <SocketIOclient.h>
#include <ArduinoJson.h>

const char* WIFI_SSID      = "YOUR_WIFI_SSID";
const char* WIFI_PASSWORD  = "YOUR_WIFI_PASSWORD";
const char* SERVER_HOST    = "192.168.1.100";
const uint16_t SERVER_PORT = 8000;
const char* DEVICE_ID      = "ESP8266-01";
const char* DEVICE_API_KEY = "sis_device_key_2025";
const char* DEVICE_TYPE    = "ESP8266";
const char* DEVICE_ZONE    = "Zone A";
const char* FIRMWARE_VER   = "1.0.0";

const unsigned long SEND_INTERVAL = 5000;

const int RELAY_PIN = D1;
const int SIREN_PIN = D2;

SocketIOclient socketIO;
unsigned long  lastSend   = 0;
bool           registered = false;
String         macAddress = "";

float readTemperature() { return 24.5 + random(-20, 30) / 10.0; }
float readHumidity()    { return 60.0 + random(-100, 100) / 10.0; }
float readMoisture()    { return 45.0 + random(-200, 200) / 10.0; }
float readFlow()        { return 1.2  + random(-5, 5) / 10.0; }
float readPH()          { return 6.8  + random(-10, 10) / 10.0; }
float readLight()       { return 15000 + random(-500, 500); }
float readPressure()    { return 1013.0 + random(-50, 50) / 10.0; }
float readWaterLevel()  { return 70.0  + random(-100, 100) / 10.0; }

void socketIOEvent(socketIOmessageType_t type, uint8_t* payload, size_t length) {
  switch (type) {

    case sIOtype_CONNECT:
      Serial.println("[Socket.IO] Connected");
      registered = false;
      registerDevice();
      break;

    case sIOtype_DISCONNECT:
      Serial.println("[Socket.IO] Disconnected");
      registered = false;
      break;

    case sIOtype_EVENT: {
      StaticJsonDocument<512> doc;
      DeserializationError err = deserializeJson(doc, payload, length);
      if (err) { Serial.print("[JSON] Error: "); Serial.println(err.c_str()); break; }

      const char* eventName = doc[0];
      Serial.print("[Event] "); Serial.println(eventName);

      if (strcmp(eventName, "device:ack") == 0) {
        bool ok = doc[1]["ok"];
        const char* msg = doc[1]["message"] | "";
        Serial.print("[ACK] ok="); Serial.print(ok); Serial.print(" "); Serial.println(msg);
        if (ok) registered = true;
      }

      else if (strcmp(eventName, "device:command") == 0) {
        const char* command    = doc[1]["command"]    | "none";
        const char* lcdMessage = doc[1]["lcdMessage"] | "";

        Serial.print("[CMD] "); Serial.println(command);

        if (strcmp(command, "irrigate_on") == 0) {
          digitalWrite(RELAY_PIN, HIGH);
          Serial.println("[PUMP] ON");
        } else if (strcmp(command, "irrigate_off") == 0) {
          digitalWrite(RELAY_PIN, LOW);
          Serial.println("[PUMP] OFF");
        } else if (strcmp(command, "siren_on") == 0) {
          digitalWrite(SIREN_PIN, HIGH);
          Serial.println("[SIREN] ON");
        } else if (strcmp(command, "siren_off") == 0) {
          digitalWrite(SIREN_PIN, LOW);
          Serial.println("[SIREN] OFF");
        } else if (strcmp(command, "lcd_message") == 0) {
          Serial.print("[LCD] "); Serial.println(lcdMessage);
        }
      }
      break;
    }

    case sIOtype_ERROR:
      Serial.println("[Socket.IO] Error");
      break;

    default:
      break;
  }
}

void registerDevice() {
  StaticJsonDocument<384> doc;
  JsonArray arr = doc.to<JsonArray>();
  arr.add("device:register");

  JsonObject data = arr.createNestedObject();
  data["apiKey"]          = DEVICE_API_KEY;
  data["deviceId"]        = DEVICE_ID;
  data["macAddress"]      = macAddress;
  data["type"]            = DEVICE_TYPE;
  data["zone"]            = DEVICE_ZONE;
  data["firmwareVersion"] = FIRMWARE_VER;
  data["signalStrength"]  = WiFi.RSSI();

  String output;
  serializeJson(doc, output);
  socketIO.sendEVENT(output);
  Serial.println("[Socket.IO] Sent device:register");
  Serial.print("[MAC] "); Serial.println(macAddress);
}

void sendSensorData() {
  float temp       = readTemperature();
  float humidity   = readHumidity();
  float moisture   = readMoisture();
  float flow       = readFlow();
  float ph         = readPH();
  float light      = readLight();
  float pressure   = readPressure();
  float waterLevel = readWaterLevel();
  bool  sirenOn    = digitalRead(SIREN_PIN);

  StaticJsonDocument<512> doc;
  JsonArray arr = doc.to<JsonArray>();
  arr.add("device:data");

  JsonObject data = arr.createNestedObject();
  data["apiKey"]      = DEVICE_API_KEY;
  data["deviceId"]    = DEVICE_ID;
  data["macAddress"]  = macAddress;
  data["type"]        = DEVICE_TYPE;
  data["zone"]        = DEVICE_ZONE;
  data["firmwareVersion"] = FIRMWARE_VER;
  data["signalStrength"]  = WiFi.RSSI();
  data["temp"]        = temp;
  data["humidity"]    = humidity;
  data["moisture"]    = moisture;
  data["flow"]        = flow;
  data["ph"]          = ph;
  data["light"]       = light;
  data["pressure"]    = pressure;
  data["waterLevel"]  = waterLevel;
  data["sirenActive"] = sirenOn;

  String output;
  serializeJson(doc, output);
  socketIO.sendEVENT(output);

  Serial.print("[DATA] temp="); Serial.print(temp);
  Serial.print(" hum=");        Serial.print(humidity);
  Serial.print(" moist=");      Serial.print(moisture);
  Serial.print(" pH=");         Serial.print(ph);
  Serial.print(" wl=");         Serial.println(waterLevel);
}

void setup() {
  Serial.begin(115200);
  delay(200);

  pinMode(RELAY_PIN, OUTPUT);
  pinMode(SIREN_PIN, OUTPUT);
  digitalWrite(RELAY_PIN, LOW);
  digitalWrite(SIREN_PIN, LOW);

  Serial.print("\n[WiFi] Connecting to ");
  Serial.println(WIFI_SSID);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.print("\n[WiFi] Connected, IP: ");
  Serial.println(WiFi.localIP());
  macAddress = WiFi.macAddress();
  macAddress.toUpperCase();
  Serial.print("[MAC] "); Serial.println(macAddress);

  socketIO.begin(SERVER_HOST, SERVER_PORT, "/device/?EIO=4");
  socketIO.setExtraHeaders("X-Device-ID: " DEVICE_ID);
  socketIO.onEvent(socketIOEvent);
  Serial.println("[Socket.IO] Connecting...");
}

void loop() {
  socketIO.loop();

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[WiFi] Reconnecting...");
    WiFi.reconnect();
    delay(5000);
    return;
  }

  unsigned long now = millis();
  if (now - lastSend >= SEND_INTERVAL) {
    lastSend = now;
    if (registered) {
      sendSensorData();
    } else {
      registerDevice();
    }
  }
}
