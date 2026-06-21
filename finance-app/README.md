# Мои Финансы — PWA

## Деплой на Vercel (шаг за шагом)

### 1. Загрузи на GitHub
1. Зайди на github.com → New repository → назови "finance-app"
2. Скачай GitHub Desktop или используй командную строку:
```
cd finance-app
git init
git add .
git commit -m "init"
git remote add origin https://github.com/ВАШ_ЛОГИН/finance-app.git
git push -u origin main
```

### 2. Задеплой на Vercel
1. Зайди на vercel.com → Log in with GitHub
2. New Project → Import "finance-app"
3. Framework Preset: Create React App
4. Build Command: npm run build
5. Output Directory: build
6. Deploy!

### 3. Установи на телефон
- iOS: открой сайт в Safari → Поделиться → На экран Домой
- Android: открой в Chrome → меню → Установить приложение
