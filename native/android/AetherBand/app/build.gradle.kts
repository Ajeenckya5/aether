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
    versionCode = 2
    versionName = "1.0.0"
  }

  val keystorePath = System.getenv("ANDROID_KEYSTORE_PATH")?.takeIf { it.isNotBlank() }

  signingConfigs {
    create("release") {
      if (keystorePath != null) {
        storeFile = file(keystorePath)
        storeType = System.getenv("ANDROID_KEYSTORE_TYPE")?.takeIf { it.isNotBlank() } ?: "pkcs12"
        storePassword = System.getenv("ANDROID_KEYSTORE_PASSWORD")
        keyAlias = System.getenv("ANDROID_KEY_ALIAS")
        keyPassword = System.getenv("ANDROID_KEY_PASSWORD")
      }
    }
  }

  buildTypes {
    debug {
      isMinifyEnabled = false
    }
    release {
      isMinifyEnabled = false
      if (keystorePath != null) {
        signingConfig = signingConfigs.getByName("release")
      }
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

tasks.matching { it.name == "assembleRelease" || it.name == "packageRelease" }.configureEach {
  doFirst {
    if (System.getenv("ANDROID_KEYSTORE_PATH").isNullOrBlank()) {
      throw GradleException("ANDROID_KEYSTORE_PATH is required to sign the release APK.")
    }
  }
}

dependencies {
  implementation("androidx.appcompat:appcompat:1.7.0")
  implementation("androidx.core:core-ktx:1.15.0")
  implementation("androidx.webkit:webkit:1.12.1")
}
