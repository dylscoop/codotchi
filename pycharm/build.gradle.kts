plugins {
    id("org.jetbrains.intellij") version "1.17.4"
    id("org.jetbrains.kotlin.jvm") version "1.9.25"
}

group = "com.gotchi"
version = "1.1.1"

repositories {
    mavenCentral()
}

intellij {
    version.set("2024.1")
    type.set("IC")   // IntelliJ Community
    plugins.set(listOf())
    updateSinceUntilBuild.set(false)
}

kotlin {
    jvmToolchain(17)
}

tasks {
    buildSearchableOptions {
        enabled = false
    }
}
