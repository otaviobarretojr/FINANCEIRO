import fs from 'node:fs'

const file = 'android/app/build.gradle'
let source = fs.readFileSync(file, 'utf8')

const versionName = (process.env.APP_VERSION || '0.1.0').replace(/^v/, '')
const versionCode = Number(process.env.VERSION_CODE || '1')

source = source.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
source = source.replace(/versionName\s+"[^"]+"/, `versionName "${versionName}"`)

if (process.env.SIGN_RELEASE === 'true' && !source.includes('signingConfigs {')) {
  source = source.replace(
    /android\s*\{/,
    `android {\n    signingConfigs {\n        release {\n            storeFile file(System.getenv("ANDROID_KEYSTORE_PATH"))\n            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")\n            keyAlias System.getenv("ANDROID_KEY_ALIAS")\n            keyPassword System.getenv("ANDROID_KEY_PASSWORD")\n        }\n    }`,
  )

  source = source.replace(
    /release\s*\{/,
    `release {\n            signingConfig signingConfigs.release`,
  )
}

fs.writeFileSync(file, source)
console.log(`Android configured: versionName=${versionName}, versionCode=${versionCode}, signed=${process.env.SIGN_RELEASE === 'true'}`)
