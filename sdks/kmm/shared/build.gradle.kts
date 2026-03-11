@file:Suppress("UnstableApiUsage")

import org.jetbrains.kotlin.gradle.dsl.JvmTarget

plugins {
    alias(libs.plugins.kotlinMultiplatform)
    alias(libs.plugins.android.kotlin.multiplatform.library)
    alias(libs.plugins.vanniktech.mavenPublish)
    alias(libs.plugins.kotlin.serialization)
}

val TRUESIGHT_SDK_VERSION: String by project
version = TRUESIGHT_SDK_VERSION

val generateVersionFile by tasks.registering {
    val outputDir = layout.buildDirectory.dir("generated/version/com/truesight/sdk")
    val versionValue = TRUESIGHT_SDK_VERSION
    inputs.property("sdkVersion", versionValue)
    outputs.dir(outputDir)
    doLast {
        val dir = outputDir.get().asFile
        dir.mkdirs()
        dir.resolve("SdkVersion.kt").writeText(
            """
            |package com.truesight.sdk
            |
            |internal const val SDK_VERSION = "$versionValue"
            """.trimMargin()
        )
    }
}

kotlin {
    androidLibrary {
        namespace = "com.truesight.sdk"
        compileSdk = libs.versions.android.compileSdk.get().toInt()
        minSdk = libs.versions.android.minSdk.get().toInt()

        optimization {
            consumerKeepRules.apply {
                publish = true
                file("consumer-rules.pro")
            }
        }

        compilations.configureEach {
            compilerOptions.configure {
                jvmTarget.set(JvmTarget.JVM_17)
            }
        }
    }

    listOf(iosX64(), iosArm64(), iosSimulatorArm64()).forEach {
        it.binaries.framework {
            baseName = "TrueSightSDK"
            isStatic = true
        }
    }

    sourceSets {
        commonMain {
            kotlin.srcDir(generateVersionFile.map { layout.buildDirectory.dir("generated/version") })
        }
        commonMain.dependencies {
            implementation(libs.kotlinx.coroutines.core)
            implementation(libs.kotlinx.serialization.json)
            implementation(libs.ktor.client.core)
            implementation(libs.ktor.client.content.negotiation)
            implementation(libs.ktor.serialization.kotlinx.json)
            implementation(libs.kotlinx.datetime)
        }
        commonTest.dependencies {
            implementation(kotlin("test"))
            implementation(libs.kotlinx.coroutines.test)
        }
        androidMain.dependencies {
            implementation(libs.ktor.client.okhttp)
            implementation(libs.androidx.security.crypto)
            implementation(libs.androidx.lifecycle.process)
            implementation(libs.androidx.annotation)
        }
        iosMain.dependencies {
            implementation(libs.ktor.client.darwin)
        }
    }
}

mavenPublishing {
    val TRUESIGHT_SDK_ARTIFACT_ID: String by project
    val GH_OWNER: String by project
    val GH_REPO: String by project

    coordinates(artifactId = TRUESIGHT_SDK_ARTIFACT_ID)

    pom {
        name = "TrueSight SDK"
        description = "Kotlin Multiplatform analytics SDK for TrueSight."
        inceptionYear = "2025"
        url = "https://github.com/$GH_OWNER/$GH_REPO"
    }

    if (project.hasProperty("signing.keyId")) {
        signAllPublications()
    }
}
