plugins {
    alias(libs.plugins.kotlinMultiplatform) apply false
    alias(libs.plugins.kotlin.serialization) apply false
    alias(libs.plugins.android.kotlin.multiplatform.library) apply false
    alias(libs.plugins.vanniktech.mavenPublish) apply false
}

subprojects {
    val GROUP: String by project
    group = GROUP

    plugins.withId("com.vanniktech.maven.publish") {
        extensions.configure<PublishingExtension>("publishing") {
            repositories {
                maven {
                    name = "GitHubPackages"
                    val owner = findProperty("GH_OWNER") as String? ?: error("GH_OWNER not set")
                    val repo = findProperty("GH_REPO") as String? ?: error("GH_REPO not set")
                    url = uri("https://maven.pkg.github.com/$owner/$repo")

                    credentials {
                        username = System.getenv("GITHUB_ACTOR")
                            ?: findProperty("gpr.user") as String? ?: ""
                        password = System.getenv("GITHUB_TOKEN")
                            ?: findProperty("gpr.key") as String? ?: ""
                    }
                }
            }
        }
    }
}
