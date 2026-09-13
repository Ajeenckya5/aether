plugins {
  id("com.android.application")
  id("org.jetbrains.kotlin.android")
}

val polyfillSrc = rootProject.file("../../ios/AetherBand/AetherBand/WebBluetoothPolyfill.js")

tasks.register<Copy>("syncPolyfill") {
  from(polyfillSrc)
  into(layout.projectDirectory.dir("src/main/assets"))
  onlyIf { polyfillSrc.exists() }
}

tasks.matching { it.name == "preBuild" }.configureEach {
  dependsOn("syncPolyfill")
}

android {
  namespace = "app.aether.band"
  compileSdk = 35

  defaultConfig {
    applicationId = "app.aether.band"
    minSdk = 26
    targetSdk = 35
    versionCode = 1
    versionName = "1.0"
  }

  signingConfigs {
    create("sideload") {
      val store = rootProject.file("../sideload.p12")
      if (store.exists()) {
        storeFile = store
        storeType = "pkcs12"
        storePassword = "aether-sideload"
        keyAlias = "aether"
        keyPassword = "aether-sideload"
      }
    }
  }

  buildTypes {
    debug {
      isMinifyEnabled = false
      signingConfig = signingConfigs.findByName("sideload") ?: signingConfigs.getByName("debug")
    }
    release {
      isMinifyEnabled = false
      signingConfig = signingConfigs.findByName("sideload") ?: signingConfigs.getByName("debug")
    }
  }

  compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
  }

  kotlinOptions {
    jvmTarget = "17"
  }

  buildFeatures {
    buildConfig = true
  }

  packaging {
    resources {
      excludes += "/META-INF/{AL2.0,LGPL2.1}"
    }
  }

  lint {
    abortOnError = false
  }
}

dependencies {
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.webkit:webkit:1.12.1")
}
